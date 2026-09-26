"""Recalculate the archived NIH ensemble result on its original val/test split."""

import argparse
import ast
import hashlib
import io
import json
import sys
import time
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from zipfile import ZipFile

import h5py
import numpy as np
import pandas as pd
import torch
import torchxrayvision as xrv
from sklearn.metrics import average_precision_score, roc_auc_score

CLASSES = (
    "Atelectasis", "Cardiomegaly", "Consolidation", "Edema", "Effusion",
    "Emphysema", "Fibrosis", "Hernia", "Infiltration", "Mass", "Nodule",
    "Pleural_Thickening", "Pneumonia", "Pneumothorax",
)
PREFIX = "Tesis_CXR/"
SPLIT_MEMBERS = {
    name: f"{PREFIX}data/processed_s4ml/{name}.csv" for name in ("val", "test")
}
MODEL_MEMBER = f"{PREFIX}code/src/models/cnn_vit.py"
NOTEBOOK_MEMBER = f"{PREFIX}code/notebooks/S4_ML_03_ensemble.ipynb"
RESULT_MEMBER = f"{PREFIX}experiments_s4ml_v2/ensemble_results.json"
EXPECTED = {
    "hdf5": "7afc343f3a29c82585d4856f00091aeac15e670422ee61aa1fe7df376ed309d6",
    "val": "3f9d69b0e1ed72392b5d1a3977dcfd07a5136d30b878db5ec6cb7b9abccca3b5",
    "test": "6bc9c420dcc222b26aa29435ff84cc513bd800d94b0a40c89f0fc6637425b459",
    "sprint4ml_v1.pt": "59f98c72981929fde8e6044a78ff46b8b23c519b8f50cd4ad4c85566bf34224b",
    "sprint4ml_v2.pt": "d93fa69ba1e348b8b4653502392a1faee6ef3883a1138968bf6ac05531401813",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checked_hash(actual: str, expected: str, name: str) -> None:
    if actual != expected:
        raise ValueError(f"SHA-256 distinto para {name}: {actual}")


def runtime_ast(source: str) -> str:
    tree = ast.parse(source)
    tree.body = [
        node for node in tree.body
        if not (
            isinstance(node, ast.If)
            and isinstance(node.test, ast.Compare)
            and isinstance(node.test.left, ast.Name)
            and node.test.left.id == "__name__"
        )
    ]
    return ast.dump(tree, include_attributes=False)


def read_archive(archive_path: Path, backend_model_path: Path) -> tuple[dict, dict]:
    with ZipFile(archive_path) as archive:
        frames = {}
        source_hashes = {}
        for name, member in SPLIT_MEMBERS.items():
            raw = archive.read(member)
            checked_hash(hashlib.sha256(raw).hexdigest(), EXPECTED[name], name)
            frames[name] = pd.read_csv(
                io.BytesIO(raw), dtype={"Image Index": str, "Patient ID": str},
            )
            source_hashes[name] = EXPECTED[name]
        notebook = archive.read(NOTEBOOK_MEMBER)
        source_hashes["notebook"] = hashlib.sha256(notebook).hexdigest()
        archived_model = archive.read(MODEL_MEMBER)
        source_hashes["archived_model"] = hashlib.sha256(archived_model).hexdigest()
        report = json.loads(archive.read(RESULT_MEMBER))

    current_model = backend_model_path.read_text(encoding="utf-8")
    if runtime_ast(archived_model.decode("utf-8-sig")) != runtime_ast(current_model):
        raise ValueError("La arquitectura ejecutable difiere del modelo archivado")
    source_hashes["backend_model"] = sha256_file(backend_model_path)
    if len(frames["val"]) != 4023 or len(frames["test"]) != 4023:
        raise ValueError("El tamano de los splits historicos cambio")
    val_patients = set(frames["val"]["Patient ID"])
    test_patients = set(frames["test"]["Patient ID"])
    if val_patients & test_patients:
        raise ValueError("Val y test comparten pacientes")
    names = pd.concat([frames["val"]["Image Index"], frames["test"]["Image Index"]])
    if names.duplicated().any():
        raise ValueError("Val y test comparten imagenes")
    for name, frame in frames.items():
        if frame[["Image Index", "Patient ID", "Finding Labels"]].isna().any().any():
            raise ValueError(f"El split {name} tiene metadatos incompletos")
    return {"frames": frames, "reported": report}, source_hashes


def labels_matrix(frame: pd.DataFrame) -> np.ndarray:
    labels = np.zeros((len(frame), len(CLASSES)), dtype=np.uint8)
    class_index = {name: index for index, name in enumerate(CLASSES)}
    for row, findings in enumerate(frame["Finding Labels"]):
        items = set(findings.split("|"))
        if not items or items - (set(CLASSES) | {"No Finding"}):
            raise ValueError("Etiqueta NIH desconocida")
        if "No Finding" in items and len(items) != 1:
            raise ValueError("No Finding mezclado con otro hallazgo")
        for finding in items - {"No Finding"}:
            labels[row, class_index[finding]] = 1
    return labels


def load_model(backend_dir: Path, artifacts: Path, checkpoint_name: str, layers: int):
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    from models.cnn_vit import CNNViT

    # Full checkpoint weights make an extra backbone download unnecessary.
    model = CNNViT(
        backbone_weights=None, num_classes=14, embedding_dim=512,
        num_heads=8, num_layers=layers, mlp_dim=1024, dropout=0.1,
    )
    checkpoint = torch.load(
        artifacts / checkpoint_name, map_location="cpu", weights_only=True,
    )
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    return model.eval()


def preprocess(image: np.ndarray, crop, resize) -> torch.Tensor:
    if image.shape != (256, 256) or image.dtype != np.uint8:
        raise ValueError("Imagen historica con pixeles inesperados")
    image = xrv.datasets.normalize(image, maxval=255, reshape=True)
    image = resize(crop(image))
    return torch.from_numpy(image).float()


def predict(model, images, frame: pd.DataFrame, batch_size: int, label: str) -> np.ndarray:
    crop = xrv.datasets.XRayCenterCrop()
    resize = xrv.datasets.XRayResizer(224)
    scores = np.empty((len(frame), len(CLASSES)), dtype=np.float32)
    with torch.inference_mode():
        for start in range(0, len(frame), batch_size):
            end = min(start + batch_size, len(frame))
            batch = torch.stack([
                preprocess(images[name][()], crop, resize)
                for name in frame["Image Index"].iloc[start:end]
            ])
            scores[start:end] = torch.sigmoid(model(batch).float()).numpy()
            if end % 512 < batch_size or end == len(frame):
                print(f"{label}: {end}/{len(frame)}", flush=True)
    return scores


def metrics(y_true: np.ndarray, scores: np.ndarray) -> dict:
    if y_true.shape != scores.shape or y_true.shape[1] != len(CLASSES):
        raise ValueError("Etiquetas y scores incompatibles")
    per_class = {}
    for index, name in enumerate(CLASSES):
        actual = y_true[:, index]
        if len(np.unique(actual)) != 2:
            raise ValueError(f"La clase {name} no tiene positivos y negativos")
        per_class[name] = {
            "n_positive": int(actual.sum()),
            "auc": float(roc_auc_score(actual, scores[:, index])),
            "ap": float(average_precision_score(actual, scores[:, index])),
        }
    return {
        "n_images": len(y_true),
        "auc_macro": float(np.mean([row["auc"] for row in per_class.values()])),
        "map": float(np.mean([row["ap"] for row in per_class.values()])),
        "per_class": per_class,
    }


def evaluate(archive: Path, hdf5_path: Path, artifacts: Path, output: Path,
             batch_size: int, threads: int) -> dict:
    if output.exists():
        raise FileExistsError("El directorio de resultados ya existe")
    if batch_size < 1 or threads < 1:
        raise ValueError("batch_size y threads deben ser positivos")
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    checked_hash(sha256_file(hdf5_path), EXPECTED["hdf5"], "HDF5 historico")
    for name in ("sprint4ml_v1.pt", "sprint4ml_v2.pt"):
        checked_hash(sha256_file(artifacts / name), EXPECTED[name], name)
    archived, source_hashes = read_archive(
        archive, backend_dir / "models" / "cnn_vit.py",
    )
    frames = archived["frames"]
    y = {name: labels_matrix(frame) for name, frame in frames.items()}
    torch.set_num_threads(threads)

    with h5py.File(hdf5_path, "r") as h5:
        images = h5["images"]
        if any(name not in images for frame in frames.values() for name in frame["Image Index"]):
            raise ValueError("Hay imagenes de val/test ausentes del HDF5 historico")
        predictions = {}
        for model_name, checkpoint, layers in (
            ("v1", "sprint4ml_v1.pt", 4), ("v2", "sprint4ml_v2.pt", 6),
        ):
            started = time.monotonic()
            model = load_model(backend_dir, artifacts, checkpoint, layers)
            for split_name, frame in frames.items():
                predictions[(split_name, model_name)] = predict(
                    model, images, frame, batch_size, f"{model_name}/{split_name}",
                )
            del model
            print(f"{model_name} completo en {time.monotonic() - started:.1f}s", flush=True)

    candidates = {}
    for weight in (0.3, 0.4, 0.5, 0.6, 0.7):
        combined = weight * predictions[("val", "v1")] + (1 - weight) * predictions[("val", "v2")]
        candidates[str(weight)] = metrics(y["val"], combined)["auc_macro"]
    chosen_weight = max((float(weight) for weight in candidates), key=lambda weight: candidates[str(weight)])
    test_combined = (
        chosen_weight * predictions[("test", "v1")]
        + (1 - chosen_weight) * predictions[("test", "v2")]
    )
    test_metrics = metrics(y["test"], test_combined)
    reported = archived["reported"]
    delta = test_metrics["auc_macro"] - reported["test_auc_macro"]
    map_delta = test_metrics["map"] - reported["test_map"]
    max_class_auc_delta = max(
        abs(test_metrics["per_class"][name]["auc"] - reported["test_auc_per_class"][name])
        for name in CLASSES
    )
    report = {
        "status": "reproduced" if (
            abs(delta) < 1e-4 and abs(map_delta) < 1e-4
            and max_class_auc_delta < 2e-4
            and chosen_weight == reported["weight_v1"]
        ) else "mismatch",
        "run_utc": datetime.now(timezone.utc).isoformat(),
        "protocol": "archived_s4ml_val_one_image_per_patient_test_one_image_per_patient",
        "source_sha256": {**source_hashes, **{name: EXPECTED[name] for name in EXPECTED if name not in source_hashes}},
        "versions": {
            "torch": torch.__version__, "numpy": np.__version__, "pandas": pd.__version__,
            "torchxrayvision": version("torchxrayvision"),
            "scikit-learn": version("scikit-learn"), "h5py": h5py.__version__,
        },
        "batch_size": batch_size,
        "threads": threads,
        "validation_auc_by_weight_v1": candidates,
        "chosen_weight_v1": chosen_weight,
        "reported_test_auc_macro": reported["test_auc_macro"],
        "reported_test_map": reported["test_map"],
        "test_auc_delta": delta,
        "test_map_delta": map_delta,
        "max_class_auc_delta": max_class_auc_delta,
        "test": test_metrics,
    }
    output.mkdir(parents=True)
    np.savez_compressed(
        output / "predictions.npz",
        val_labels=y["val"], test_labels=y["test"],
        val_v1=predictions[("val", "v1")], val_v2=predictions[("val", "v2")],
        test_v1=predictions[("test", "v1")], test_v2=predictions[("test", "v2")],
    )
    report["predictions_sha256"] = sha256_file(output / "predictions.npz")
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--hdf5", type=Path, required=True)
    parser.add_argument("--artifacts-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--threads", type=int, default=6)
    args = parser.parse_args()
    report = evaluate(
        args.archive, args.hdf5, args.artifacts_dir, args.output_dir,
        args.batch_size, args.threads,
    )
    print(json.dumps({
        "status": report["status"], "auc_macro": report["test"]["auc_macro"],
        "map": report["test"]["map"], "chosen_weight_v1": report["chosen_weight_v1"],
        "output": str(args.output_dir),
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
