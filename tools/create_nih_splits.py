"""Create a new patient-disjoint multilabel split for future NIH training."""

import argparse
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile

import h5py
import numpy as np
import pandas as pd
from iterstrat.ml_stratifiers import MultilabelStratifiedShuffleSplit

CSV_MEMBER = "Tesis_CXR/data/raw/nih/Data_Entry_2017.csv"
CLASSES = (
    "Atelectasis", "Cardiomegaly", "Consolidation", "Edema", "Effusion",
    "Emphysema", "Fibrosis", "Hernia", "Infiltration", "Mass", "Nodule",
    "Pleural_Thickening", "Pneumonia", "Pneumothorax",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_metadata(metadata_zip: Path) -> tuple[pd.DataFrame, str]:
    with ZipFile(metadata_zip) as archive:
        raw = archive.read(CSV_MEMBER)
    metadata_hash = hashlib.sha256(raw).hexdigest()
    frame = pd.read_csv(
        io.BytesIO(raw), dtype={"Image Index": str, "Patient ID": str},
    )
    required = {"Image Index", "Patient ID", "Finding Labels", "View Position"}
    if required - set(frame) or frame[list(required)].isna().any().any():
        raise ValueError("El CSV NIH carece de columnas o valores obligatorios")
    if len(frame) != 112120 or frame["Image Index"].duplicated().any():
        raise ValueError("El CSV NIH no contiene 112120 imagenes unicas")
    if not set(frame["View Position"]).issubset({"PA", "AP"}):
        raise ValueError("Se encontraron vistas distintas de PA/AP")
    labels = [set(value.split("|")) for value in frame["Finding Labels"]]
    if any(not items or items - (set(CLASSES) | {"No Finding"}) for items in labels):
        raise ValueError("El CSV NIH contiene etiquetas desconocidas")
    if any("No Finding" in items and len(items) != 1 for items in labels):
        raise ValueError("No Finding no puede coexistir con un hallazgo")
    frame["is_no_finding"] = [int(items == {"No Finding"}) for items in labels]
    for name in CLASSES:
        frame[name] = np.fromiter((name in items for items in labels), dtype=np.int8)
    return frame, metadata_hash


def assign_patients(frame: pd.DataFrame, seed: int) -> dict[str, set[str]]:
    by_patient = frame.groupby("Patient ID", sort=True)[list(CLASSES)].max()
    patients = by_patient.index.to_numpy()
    labels = by_patient.to_numpy(dtype=np.int8)
    dummy = np.zeros((len(patients), 1), dtype=np.uint8)
    first = MultilabelStratifiedShuffleSplit(n_splits=1, test_size=0.15, random_state=seed)
    train_val, test = next(first.split(dummy, labels))
    second = MultilabelStratifiedShuffleSplit(
        n_splits=1, test_size=0.15 / 0.85, random_state=seed + 1,
    )
    train_rel, val_rel = next(second.split(dummy[train_val], labels[train_val]))
    return {
        "train": set(patients[train_val[train_rel]]),
        "val": set(patients[train_val[val_rel]]),
        "test": set(patients[test]),
    }


def create_splits(
    metadata_zip: Path, hdf5_path: Path, output_dir: Path, seed: int = 42,
) -> dict:
    if output_dir.exists():
        raise FileExistsError("El directorio de salida ya existe; no se sobrescribira")
    frame, metadata_hash = read_metadata(metadata_zip)
    expected_images = set(frame["Image Index"])
    with h5py.File(hdf5_path, "r") as h5:
        if "images" not in h5 or set(h5["images"].keys()) != expected_images:
            raise ValueError("El HDF5 no cubre exactamente el CSV NIH completo")
        if "image_names" not in h5 or len(h5["image_names"]) != len(frame):
            raise ValueError("La lista image_names del HDF5 esta incompleta")
        image_names = {
            name.decode("utf-8") if isinstance(name, bytes) else str(name)
            for name in h5["image_names"][:]
        }
        if image_names != expected_images:
            raise ValueError("La lista image_names difiere de las imagenes del CSV")

    patient_sets = assign_patients(frame, seed)
    all_patients = set(frame["Patient ID"])
    if set.union(*patient_sets.values()) != all_patients:
        raise ValueError("Los splits no cubren todos los pacientes")
    if any(patient_sets[a] & patient_sets[b] for a, b in (
        ("train", "val"), ("train", "test"), ("val", "test"),
    )):
        raise ValueError("Hay pacientes compartidos entre splits")

    columns = [
        "Image Index", "Finding Labels", "Patient ID", "View Position", "is_no_finding",
        *CLASSES,
    ]
    prepared = {
        name: frame.loc[frame["Patient ID"].isin(patients), columns].copy()
        for name, patients in patient_sets.items()
    }
    if sum(len(split) for split in prepared.values()) != len(frame):
        raise ValueError("Los splits no cubren todas las imagenes")
    for name, split in prepared.items():
        if len(split) < len(patient_sets[name]):
            raise ValueError("Un paciente del split carece de imagenes")
        if any(int(split[label].sum()) == 0 for label in CLASSES):
            raise ValueError(f"El split {name} no tiene positivos de todas las clases")

    output_dir.mkdir(parents=True)
    split_hashes = {}
    for name, split in prepared.items():
        path = output_dir / f"{name}.csv"
        split.to_csv(path, index=False)
        split_hashes[name] = sha256_file(path)
    manifest = {
        "status": "new_protocol_for_future_training_only",
        "legacy_checkpoints_eligible_for_independent_test": False,
        "algorithm": "MultilabelStratifiedShuffleSplit",
        "iterative_stratification_version": "0.1.9",
        "seed": seed,
        "patient_ratios": {"train": 0.70, "val": 0.15, "test": 0.15},
        "metadata_sha256": metadata_hash,
        "hdf5_sha256": sha256_file(hdf5_path),
        "split_sha256": split_hashes,
        "image_counts": {name: len(split) for name, split in prepared.items()},
        "patient_counts": {name: len(patients) for name, patients in patient_sets.items()},
        "class_positives": {
            name: {label: int(split[label].sum()) for label in CLASSES}
            for name, split in prepared.items()
        },
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="utf-8",
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata-zip", type=Path, required=True)
    parser.add_argument("--hdf5", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    manifest = create_splits(args.metadata_zip, args.hdf5, args.output_dir, args.seed)
    print(json.dumps(manifest, indent=2), flush=True)


if __name__ == "__main__":
    main()
