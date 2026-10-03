"""Evaluate fixed operating points on verified historical predictions, without fitting."""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

from calibrate_legacy_ensemble import CLASSES, evaluate, validate

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))
from evaluation_evidence import EXPECTED_SHA256, HISTORICAL_TEST  # noqa: E402


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def operating_metrics(labels, scores, thresholds):
    # The API compares scores rounded to six decimals with >= threshold.
    rounded = np.array([[round(float(p), 6) for p in row] for row in scores])
    result = evaluate(labels, rounded, thresholds)
    rows = result["per_class"]
    for row in rows.values():
        row["npv"] = row["tn"] / (row["tn"] + row["fn"]) if row["tn"] + row["fn"] else None
        row["n_positive"] = row["tp"] + row["fn"]
        row["n_negative"] = row["tn"] + row["fp"]
        # Discrimination metrics remain in the original historical evidence.
        del row["auc"], row["ap"]
    return rows


def run(predictions, evidence_path, artifacts, output):
    if output.exists():
        raise FileExistsError("Choose a new output file; existing evidence is never overwritten")
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    digest = sha256(predictions)
    if evidence.get("status") != "reproduced" or evidence.get("predictions_sha256") != digest:
        raise ValueError("Predictions do not match the verified reproduction")
    sources = evidence["source_sha256"]
    if sources.get("test") != HISTORICAL_TEST["test_split_sha256"]:
        raise ValueError("Unexpected historical test split")
    hashes = {name: sha256(artifacts / name) for name in EXPECTED_SHA256}
    if hashes != EXPECTED_SHA256:
        raise ValueError("Model artifacts do not match the historical evaluation")
    for name in ("sprint4ml_v1.pt", "sprint4ml_v2.pt"):
        if sources.get(name) != hashes[name]:
            raise ValueError("Reproduction checkpoint mismatch")
    for name in ("labels_14.json", "thresholds_14.json"):
        hashes[name] = sha256(artifacts / name)
    classes = json.loads((artifacts / "labels_14.json").read_text(encoding="utf-8"))
    if [classes.get(str(i)) for i in range(14)] != list(CLASSES):
        raise ValueError("Unexpected label order")
    config = json.loads((artifacts / "ensemble_config.json").read_text(encoding="utf-8"))
    threshold_config = json.loads((artifacts / "thresholds_14.json").read_text(encoding="utf-8"))
    temperature = threshold_config.get("temperature", 1.)
    weights = [config["weight_v1"], config["weight_v2"]]
    if temperature != 1. or weights != [.3, .7] or evidence["chosen_weight_v1"] != weights[0]:
        raise ValueError("Saved component predictions support only the original weights and T=1")
    with np.load(predictions, allow_pickle=False) as data:
        labels = data["test_labels"]
        for name in ("test_v1", "test_v2"):
            validate(labels, data[name])
        if len(labels) != HISTORICAL_TEST["n_test_images"]:
            raise ValueError("Unexpected historical test size")
        scores = weights[0] * data["test_v1"] + weights[1] * data["test_v2"]
        rows = operating_metrics(labels, scores, threshold_config["thresholds"])
    result = {
        "schema_version": 1,
        "status": "historical_fixed_thresholds",
        "dataset": "NIH ChestX-ray14",
        "evaluation_date": "2026-10-03",
        "n_images": len(labels), "n_patients": len(labels),
        "protocol": evidence["protocol"], "classes": list(CLASSES),
        "threshold_selection": "existing_configuration_not_optimized_in_this_evaluation",
        "thresholds": threshold_config["thresholds"], "temperature": temperature,
        "weights": weights, "decision_rule": "round_score_6_decimals_greater_or_equal",
        "preprocessing": "archived_xrv_normalize_center_crop_XRayResizer_224",
        "runtime_preprocessing_equivalence": "not_verified",
        "artifact_sha256": hashes, "predictions_sha256": digest,
        "reproduction_report_sha256": sha256(evidence_path), "source_sha256": sources,
        "generator_sha256": sha256(Path(__file__)),
        "per_class": rows,
        "limitations": [
            "Previously inspected retrospective internal test; no external clinical validation",
            "Possible NIH exposure during backbone pretraining",
            "Runtime uses full-image OpenCV resize; preprocessing equivalence not verified",
            "No confidence intervals; sparse positive support for some classes",
            "Configured thresholds have not been clinically optimized or approved",
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--evidence-report", type=Path, required=True)
    parser.add_argument("--artifacts-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = run(args.predictions, args.evidence_report, args.artifacts_dir, args.output)
    print(json.dumps({"status": report["status"], "n_images": report["n_images"],
                      "n_classes": len(report["per_class"])}))
