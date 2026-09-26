"""Train a scratch-initialized CNN-ViT and evaluate the frozen NIH test split once."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import time
from pathlib import Path

import h5py
import numpy as np
import pandas as pd
import torch
from sklearn.metrics import average_precision_score, roc_auc_score, roc_curve
from torch.utils.data import DataLoader, Dataset

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_HDF5_SHA256 = "c57aed9b21ba26447f9d46c532e0b393179c112253ee70e1166d75ec7ff495c8"
SPLITS = ("train", "val", "test")
METRICS = ("auc", "ap", "sensitivity", "specificity", "precision", "npv", "f1")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_inputs(hdf5_path: Path, splits_dir: Path, manifest: dict) -> dict[str, pd.DataFrame]:
    actual_hdf5_hash = sha256_file(hdf5_path)
    if actual_hdf5_hash != manifest["hdf5_sha256"] or actual_hdf5_hash != EXPECTED_HDF5_SHA256:
        raise ValueError("El HDF5 no coincide con el corpus auditado; no se inicia el entrenamiento.")

    frames = {}
    patient_sets = {}
    for name in SPLITS:
        path = splits_dir / f"{name}.csv"
        if sha256_file(path) != manifest["split_sha256"][name]:
            raise ValueError(f"El hash del split {name} no coincide con el manifiesto.")
        frame = pd.read_csv(path, dtype={"Image Index": str, "Patient ID": str})
        required = {"Image Index", "Patient ID", *manifest["classes"]}
        if not required.issubset(frame.columns) or frame[list(required)].isna().any().any():
            raise ValueError(f"El split {name} no contiene las columnas requeridas.")
        if frame["Image Index"].duplicated().any():
            raise ValueError(f"El split {name} contiene imagenes repetidas.")
        frames[name] = frame
        patient_sets[name] = set(frame["Patient ID"])

    for i, left in enumerate(SPLITS):
        for right in SPLITS[i + 1 :]:
            if patient_sets[left] & patient_sets[right]:
                raise ValueError(f"Los splits {left} y {right} comparten pacientes.")

    expected_names = set().union(*(set(frame["Image Index"]) for frame in frames.values()))
    with h5py.File(hdf5_path, "r") as h5:
        if "images" not in h5 or not expected_names.issubset(h5["images"].keys()):
            raise ValueError("El HDF5 no contiene todas las imagenes de los splits.")
    return frames


class NihDataset(Dataset):
    def __init__(self, frame: pd.DataFrame, hdf5_path: Path, classes: list[str]):
        self.names = frame["Image Index"].to_numpy(dtype=str)
        self.patient_ids = frame["Patient ID"].to_numpy(dtype=str)
        self.labels = frame[classes].to_numpy(dtype=np.float32)
        self.hdf5_path = str(hdf5_path)
        self._h5 = None

    def __len__(self):
        return len(self.names)

    def __getstate__(self):
        state = self.__dict__.copy()
        state["_h5"] = None
        return state

    def __getitem__(self, index):
        if self._h5 is None:
            self._h5 = h5py.File(self.hdf5_path, "r")
        pixels = self._h5["images"][self.names[index]][()]
        if pixels.shape != (256, 256) or pixels.dtype != np.uint8:
            raise ValueError(f"Formato de pixels inesperado: {self.names[index]}")
        if str(ROOT / "backend") not in sys.path:
            sys.path.insert(0, str(ROOT / "backend"))
        from utils.image_utils import preprocess_for_model

        image = preprocess_for_model(pixels)[0]
        return image, torch.from_numpy(self.labels[index]), self.patient_ids[index]


def select_thresholds(labels: np.ndarray, scores: np.ndarray) -> np.ndarray:
    thresholds = []
    for index in range(labels.shape[1]):
        fpr, tpr, candidates = roc_curve(labels[:, index], scores[:, index])
        thresholds.append(float(candidates[np.argmax(tpr - fpr)]))
    return np.asarray(thresholds)


def class_metrics(labels: np.ndarray, scores: np.ndarray, thresholds: np.ndarray) -> dict:
    report = {}
    for index, threshold in enumerate(thresholds):
        truth = labels[:, index].astype(bool)
        pred = scores[:, index] >= threshold
        tp = int(np.logical_and(truth, pred).sum())
        fp = int(np.logical_and(~truth, pred).sum())
        fn = int(np.logical_and(truth, ~pred).sum())
        tn = int(np.logical_and(~truth, ~pred).sum())
        report[index] = {
            "auc": float(roc_auc_score(truth, scores[:, index])),
            "ap": float(average_precision_score(truth, scores[:, index])),
            "sensitivity": tp / max(tp + fn, 1),
            "specificity": tn / max(tn + fp, 1),
            "precision": tp / max(tp + fp, 1),
            "npv": tn / max(tn + fn, 1),
            "f1": 2 * tp / max(2 * tp + fp + fn, 1),
            "threshold": float(threshold),
            "positives": int(truth.sum()),
        }
    return report


def patient_bootstrap(
    labels: np.ndarray,
    scores: np.ndarray,
    patient_ids: np.ndarray,
    thresholds: np.ndarray,
    replicates: int,
    seed: int,
) -> dict:
    groups: dict[str, np.ndarray] = {}
    for patient in np.unique(patient_ids):
        groups[str(patient)] = np.flatnonzero(patient_ids == patient)
    patient_names = np.asarray(list(groups))
    generator = np.random.default_rng(seed)
    samples = {metric: [] for metric in METRICS}
    per_class = {str(index): {metric: [] for metric in METRICS} for index in range(labels.shape[1])}

    for _ in range(replicates):
        chosen = generator.choice(patient_names, len(patient_names), replace=True)
        rows = np.concatenate([groups[patient] for patient in chosen])
        if any(np.unique(labels[rows, index]).size < 2 for index in range(labels.shape[1])):
            continue
        report = class_metrics(labels[rows], scores[rows], thresholds)
        for metric in METRICS:
            values = [entry[metric] for entry in report.values() if np.isfinite(entry[metric])]
            samples[metric].append(float(np.mean(values)))
            for index, entry in report.items():
                per_class[str(index)][metric].append(entry[metric])

    def interval(values: list[float]) -> list[float]:
        return [float(value) for value in np.quantile(values, [0.025, 0.975])]

    return {
        "macro": {metric: interval(values) for metric, values in samples.items()},
        "per_class": {
            index: {metric: interval(values) for metric, values in class_values.items()}
            for index, class_values in per_class.items()
        },
        "unit": "patient",
        "replicates": len(samples["auc"]),
        "requested_replicates": replicates,
    }


def run_epoch(model, loader, device, optimizer=None):
    training = optimizer is not None
    model.train(training)
    loss_fn = torch.nn.BCEWithLogitsLoss()
    all_labels, all_scores, all_patients = [], [], []
    loss_total = 0.0
    for images, labels, patients in loader:
        images, labels = images.to(device), labels.to(device)
        with torch.set_grad_enabled(training):
            logits = model(images)
            loss = loss_fn(logits, labels)
            if training:
                optimizer.zero_grad(set_to_none=True)
                loss.backward()
                optimizer.step()
        loss_total += float(loss.detach()) * len(labels)
        all_labels.append(labels.cpu().numpy())
        all_scores.append(torch.sigmoid(logits.detach()).cpu().numpy())
        all_patients.extend(patients)
    return (
        loss_total / len(loader.dataset),
        np.concatenate(all_labels),
        np.concatenate(all_scores),
        np.asarray(all_patients),
    )


def train(args):
    if args.output_dir.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError("Checkpoint y reporte deben guardarse fuera del repositorio.")
    if min(args.epochs, args.patience, args.batch_size, args.threads, args.bootstrap_replicates) < 1:
        raise ValueError("Epocas, paciencia, batch, hilos y replicas deben ser mayores que cero.")
    if args.workers < 0:
        raise ValueError("workers no puede ser negativo.")
    if not torch.cuda.is_available() and not args.allow_cpu:
        raise RuntimeError(
            "No se detecto GPU CUDA. El entrenamiento completo es demasiado costoso para CPU; "
            "usa una maquina GPU o --allow-cpu solo para una ejecucion exploratoria."
        )
    manifest = json.loads((args.splits_dir / "manifest.json").read_text(encoding="utf-8"))
    labels_doc = json.loads((ROOT / "backend/artifacts/labels_14.json").read_text(encoding="utf-8"))
    classes = [labels_doc[str(index)] for index in range(len(labels_doc))]
    if manifest.get("status") != "new_protocol_for_future_training_only":
        raise ValueError("Manifiesto de split inesperado.")
    manifest["classes"] = classes
    frames = verify_inputs(args.hdf5, args.splits_dir, manifest)
    if args.output_dir.exists():
        raise FileExistsError("El directorio de salida ya existe; el experimento no sobrescribe resultados.")

    args.output_dir.mkdir(parents=True)
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.set_num_threads(args.threads)

    loaders = {
        name: DataLoader(
            NihDataset(frames[name], args.hdf5, classes),
            batch_size=args.batch_size,
            shuffle=name == "train",
            num_workers=args.workers,
            pin_memory=device.type == "cuda",
        )
        for name in SPLITS
    }
    if str(ROOT / "backend") not in sys.path:
        sys.path.insert(0, str(ROOT / "backend"))
    from models.cnn_vit import CNNViT

    model = CNNViT(
        backbone_weights=None,
        num_classes=len(classes),
        embedding_dim=args.embedding_dim,
        num_heads=args.num_heads,
        num_layers=args.num_layers,
        mlp_dim=args.mlp_dim,
        dropout=args.dropout,
    ).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=args.weight_decay)
    best_auc, best_epoch, wait = -1.0, 0, 0
    checkpoint_path = args.output_dir / "best_model.pt"
    started = time.time()

    for epoch in range(1, args.epochs + 1):
        train_loss, _, _, _ = run_epoch(model, loaders["train"], device, optimizer)
        val_loss, val_labels, val_scores, _ = run_epoch(model, loaders["val"], device)
        val_auc = float(np.mean([roc_auc_score(val_labels[:, i], val_scores[:, i]) for i in range(len(classes))]))
        val_ap = float(np.mean([average_precision_score(val_labels[:, i], val_scores[:, i]) for i in range(len(classes))]))
        print(
            f"epoch={epoch} train_loss={train_loss:.5f} val_loss={val_loss:.5f} "
            f"val_auc_macro={val_auc:.5f} val_ap_macro={val_ap:.5f}", flush=True,
        )
        if val_auc > best_auc:
            best_auc, best_epoch, wait = val_auc, epoch, 0
            temporary = checkpoint_path.with_suffix(".tmp")
            torch.save({"model_state_dict": model.state_dict(), "epoch": epoch}, temporary)
            temporary.replace(checkpoint_path)
        else:
            wait += 1
            if wait >= args.patience:
                break

    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=True)
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    _, val_labels, val_scores, _ = run_epoch(model, loaders["val"], device)
    thresholds = select_thresholds(val_labels, val_scores)
    _, test_labels, test_scores, test_patients = run_epoch(model, loaders["test"], device)
    final_metrics = class_metrics(test_labels, test_scores, thresholds)
    final_metrics["macro"] = {
        metric: float(np.mean([entry[metric] for entry in final_metrics.values()]))
        for metric in METRICS
    }
    bootstrap = patient_bootstrap(
        test_labels, test_scores, test_patients, thresholds, args.bootstrap_replicates, args.seed,
    )
    for index, class_name in enumerate(classes):
        final_metrics[class_name] = final_metrics.pop(index)
        bootstrap["per_class"][class_name] = bootstrap["per_class"].pop(str(index))

    result = {
        "status": "completed",
        "initialization": "random_weights_no_NIH_pretraining",
        "selection_metric": "validation_macro_auroc",
        "threshold_method": "Youden J on validation; exploratory, not a clinically agreed operating point",
        "best_epoch": best_epoch,
        "best_validation_macro_auroc": best_auc,
        "test_evaluation_policy": "one final evaluation after validation-based checkpoint and threshold selection; do not tune on test",
        "test_metrics": final_metrics,
        "patient_bootstrap_95ci": bootstrap,
        "classes": classes,
        "hdf5_sha256": manifest["hdf5_sha256"],
        "split_sha256": manifest["split_sha256"],
        "checkpoint_sha256": sha256_file(checkpoint_path),
        "device": str(device),
        "elapsed_seconds": round(time.time() - started, 2),
        "config": vars(args) | {"hdf5": str(args.hdf5), "splits_dir": str(args.splits_dir), "output_dir": str(args.output_dir)},
    }
    (args.output_dir / "report.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "best_epoch": best_epoch, "device": str(device), "report": str(args.output_dir / 'report.json')}, indent=2), flush=True)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hdf5", type=Path, required=True)
    parser.add_argument("--splits-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--patience", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--embedding-dim", type=int, default=512)
    parser.add_argument("--num-heads", type=int, default=8)
    parser.add_argument("--num-layers", type=int, default=4)
    parser.add_argument("--mlp-dim", type=int, default=1024)
    parser.add_argument("--dropout", type=float, default=0.1)
    parser.add_argument("--bootstrap-replicates", type=int, default=500)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--allow-cpu", action="store_true", help="Permite entrenar en CPU; no recomendado para el experimento completo.")
    return parser.parse_args()


if __name__ == "__main__":
    train(parse_args())
