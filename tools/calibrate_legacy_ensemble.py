"""Offline retrospective calibration; never changes production artifacts."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import minimize_scalar
from scipy.special import expit, logit
from sklearn.metrics import average_precision_score, roc_auc_score, roc_curve

CLASSES = (
    "Atelectasis", "Cardiomegaly", "Consolidation", "Edema", "Effusion",
    "Emphysema", "Fibrosis", "Hernia", "Infiltration", "Mass", "Nodule",
    "Pleural_Thickening", "Pneumonia", "Pneumothorax",
)
SENSITIVITY_TARGETS = {"Infiltration": .70, "Pneumonia": .65, "Effusion": .60, "Edema": .60}


def validate(labels, scores):
    if labels.ndim != 2 or labels.shape != scores.shape or not len(labels):
        raise ValueError("Labels and scores must be nonempty matching matrices")
    if not np.isfinite(scores).all() or np.any((scores < 0) | (scores > 1)):
        raise ValueError("Scores must be finite probabilities in [0, 1]")
    if not np.isin(labels, [0, 1]).all():
        raise ValueError("Labels must be binary")


def transform(scores, temperature):
    if not np.isfinite(temperature) or temperature <= 0:
        raise ValueError("Temperature must be finite and positive")
    # Calibrate the final ensemble score, not the logits of its components.
    return expit(logit(np.clip(scores.astype(float), 1e-7, 1 - 1e-7)) / temperature)


def nll(labels, scores):
    p = np.clip(scores, 1e-7, 1 - 1e-7)
    return float(-(labels * np.log(p) + (1 - labels) * np.log1p(-p)).mean())


def fit_temperature(labels, scores):
    validate(labels, scores)
    result = minimize_scalar(
        lambda t: nll(labels, transform(scores, t)), bounds=(.1, 10.), method="bounded",
    )
    if not result.success or not np.isfinite(result.fun):
        raise ValueError("Temperature optimization failed")
    # Include the uncalibrated model explicitly; never select using test.
    return float(result.x) if result.fun < nll(labels, transform(scores, 1.)) else 1.


def select_thresholds(labels, scores):
    validate(labels, scores)
    if scores.shape[1] != len(CLASSES):
        raise ValueError("Expected the fixed 14-class order")
    thresholds = {}
    for i, name in enumerate(CLASSES):
        if np.unique(labels[:, i]).size != 2:
            raise ValueError(f"Validation class lacks positives or negatives: {name}")
        fpr, tpr, candidates = roc_curve(labels[:, i], scores[:, i], drop_intermediate=False)
        eligible = np.isfinite(candidates) & (candidates >= 0) & (candidates <= 1)
        target = SENSITIVITY_TARGETS.get(name)
        if target is not None:
            eligible &= tpr >= target
        indices = np.flatnonzero(eligible)
        if not len(indices):
            raise ValueError(f"No eligible threshold: {name}")
        objective = 1 - fpr if target is not None else tpr - fpr
        best = indices[np.argmax(objective[indices])]
        thresholds[name] = float(candidates[best])
    return thresholds


def evaluate(labels, scores, thresholds):
    validate(labels, scores)
    if scores.shape[1] != len(CLASSES) or set(thresholds) != set(CLASSES):
        raise ValueError("Expected scores and thresholds for the fixed 14-class order")
    if any(not np.isfinite(t) or not 0 <= t <= 1 for t in thresholds.values()):
        raise ValueError("Thresholds must be finite probabilities")
    report = {}
    for i, name in enumerate(CLASSES):
        y, pred = labels[:, i].astype(bool), scores[:, i] >= thresholds[name]
        tp, fp = int((y & pred).sum()), int((~y & pred).sum())
        tn, fn = int((~y & ~pred).sum()), int((y & ~pred).sum())
        both = np.unique(y).size == 2
        report[name] = {
            "auc": float(roc_auc_score(y, scores[:, i])) if both else None,
            "ap": float(average_precision_score(y, scores[:, i])) if y.any() else None,
            "sensitivity": tp / (tp + fn) if tp + fn else None,
            "specificity": tn / (tn + fp) if tn + fp else None,
            "precision": tp / (tp + fp) if tp + fp else None,
            "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None,
            "tp": tp, "fp": fp, "tn": tn, "fn": fn, "threshold": thresholds[name],
        }
    means = {}
    for metric in ["auc", "ap", "sensitivity", "specificity", "precision", "f1"]:
        values = [r[metric] for r in report.values() if r[metric] is not None]
        means[metric] = float(np.mean(values)) if values else None
    return {"n_images": len(labels), "nll": nll(labels, scores),
            "brier": float(np.mean((scores - labels) ** 2)), "macro": means, "per_class": report}


def run(predictions, evidence_path, output, evaluate_test=False):
    if output.exists():
        raise FileExistsError("Choose a new output directory")
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    digest = hashlib.sha256(predictions.read_bytes()).hexdigest()
    if evidence.get("status") != "reproduced" or evidence.get("predictions_sha256") != digest:
        raise ValueError("Predictions do not match the verified reproduction report")
    weight = float(evidence["chosen_weight_v1"])
    if not 0 <= weight <= 1:
        raise ValueError("Invalid ensemble weight")
    with np.load(predictions, allow_pickle=False) as data:
        labels = data["val_labels"]
        validate(labels, data["val_v1"])
        validate(labels, data["val_v2"])
        raw = weight * data["val_v1"] + (1 - weight) * data["val_v2"]
        temperature = fit_temperature(labels, raw)
        scores = transform(raw, temperature)
        thresholds = select_thresholds(labels, scores)
        raw_thresholds = select_thresholds(labels, raw)
        result = {
            "status": "offline_candidate_not_for_deployment",
            "method": "sigmoid_logit_final_ensemble_score_over_temperature_v1",
            "fit_split": "validation", "temperature": temperature, "weight_v1": weight,
            "temperature_search_bounds": [.1, 10.],
            "temperature_near_search_boundary": bool(temperature <= .1001 or temperature >= 9.9999),
            "classes": list(CLASSES), "thresholds": thresholds,
            "threshold_criteria": {"default": "Youden J", **SENSITIVITY_TARGETS},
            "predictions_sha256": digest, "source_sha256": evidence["source_sha256"],
            "validation_raw": evaluate(labels, raw, raw_thresholds),
            "validation_candidate": evaluate(labels, scores, thresholds),
            "limitations": ["Retrospective previously inspected NIH test", "Possible NIH pretraining exposure",
                            "No external or clinical validation", "One global temperature cannot correct every class bias",
                            "Not compatible with runtime per-component temperature without a reviewed migration"],
        }
        if evaluate_test:
            test_labels = data["test_labels"]
            validate(test_labels, data["test_v1"])
            validate(test_labels, data["test_v2"])
            test_raw = weight * data["test_v1"] + (1 - weight) * data["test_v2"]
            result["test_raw"] = evaluate(test_labels, test_raw, raw_thresholds)
            result["test_candidate"] = evaluate(test_labels, transform(test_raw, temperature), thresholds)
    output.mkdir(parents=True)
    (output / "calibration_report.json").write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--evidence-report", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--evaluate-test", action="store_true")
    args = parser.parse_args()
    report = run(args.predictions, args.evidence_report, args.output_dir, args.evaluate_test)
    print(json.dumps({"status": report["status"], "temperature": report["temperature"],
                      "val_nll_before": report["validation_raw"]["nll"],
                      "val_nll_after": report["validation_candidate"]["nll"]}))
