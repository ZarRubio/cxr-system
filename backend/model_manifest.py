"""Build and verify a content-addressed manifest for deployed model artifacts."""

import argparse
import hashlib
import json
import math
from pathlib import Path

ARTIFACT_NAMES = (
    "sprint4ml_v1.pt",
    "sprint4ml_v2.pt",
    "ensemble_config.json",
    "model_config_14.json",
    "thresholds_14.json",
    "labels_14.json",
)
MANIFEST_NAME = "model_manifest.json"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_config(artifacts: Path) -> dict:
    ensemble = json.loads((artifacts / "ensemble_config.json").read_text(encoding="utf-8"))
    model = json.loads((artifacts / "model_config_14.json").read_text(encoding="utf-8"))
    thresholds = json.loads((artifacts / "thresholds_14.json").read_text(encoding="utf-8"))["thresholds"]
    labels = json.loads((artifacts / "labels_14.json").read_text(encoding="utf-8"))

    classes = [labels.get(str(index)) for index in range(14)]
    if model.get("num_classes") != 14 or any(not name for name in classes):
        raise ValueError("La configuracion debe contener exactamente 14 clases ordenadas")
    if len(set(classes)) != 14 or set(thresholds) != set(classes):
        raise ValueError("Las clases y los umbrales no coinciden")
    if any(
        not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1
        for value in thresholds.values()
    ):
        raise ValueError("Los umbrales deben ser numeros finitos entre 0 y 1")
    weights = [ensemble.get("weight_v1"), ensemble.get("weight_v2")]
    if any(not isinstance(w, (int, float)) or not math.isfinite(w) or w < 0 for w in weights):
        raise ValueError("Pesos del ensemble invalidos")
    if not math.isclose(sum(weights), 1.0, abs_tol=1e-6):
        raise ValueError("Los pesos del ensemble deben sumar 1")
    if (ensemble.get("checkpoint_v1"), ensemble.get("checkpoint_v2")) != ARTIFACT_NAMES[:2]:
        raise ValueError("Los nombres de checkpoints no coinciden con los artefactos esperados")
    return ensemble


def build_manifest(artifacts_dir: Path, app_commit: str | None = None) -> dict:
    artifacts = Path(artifacts_dir)
    ensemble = _validate_config(artifacts)
    hashes = {name: _sha256(artifacts / name) for name in ARTIFACT_NAMES}
    fingerprint_source = "".join(f"{name}:{hashes[name]}\n" for name in ARTIFACT_NAMES)
    fingerprint = hashlib.sha256(fingerprint_source.encode("ascii")).hexdigest()
    return {
        "schema_version": 1,
        "model_fingerprint": fingerprint,
        "artifact_sha256": hashes,
        "app_commit": app_commit,
        "research_commit": None,
        "dataset_audit": "pending",
        "evaluation_evidence": "not_linked",
        "reported_test_auc_macro": ensemble.get("test_auc_macro"),
        "verification_scope": "artifact_integrity_only",
    }


def verify_manifest(artifacts_dir: Path, required: bool = False) -> dict | None:
    artifacts = Path(artifacts_dir)
    manifest_path = artifacts / MANIFEST_NAME
    if not manifest_path.exists():
        if required:
            raise ValueError("Falta el manifiesto de artefactos del modelo")
        return None
    saved = json.loads(manifest_path.read_text(encoding="utf-8"))
    if saved.get("schema_version") != 1:
        raise ValueError("Version del manifiesto no soportada")
    actual = build_manifest(artifacts, app_commit=saved.get("app_commit"))
    if saved != actual:
        raise ValueError("El manifiesto no coincide con los artefactos del modelo")
    return actual


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera un manifiesto verificable del ensemble")
    parser.add_argument("--artifacts-dir", type=Path, required=True)
    parser.add_argument("--app-commit", default=None)
    args = parser.parse_args()
    manifest = build_manifest(args.artifacts_dir, app_commit=args.app_commit)
    output = args.artifacts_dir / MANIFEST_NAME
    output.write_text(json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"{output}: {manifest['model_fingerprint']}")


if __name__ == "__main__":
    main()
