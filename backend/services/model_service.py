"""
Carga dos modelos CNN-ViT y realiza inferencia en ensemble.
"""
import json
from pathlib import Path

import numpy as np
import torch

from models.cnn_vit import CNNViT

CLASSES_14 = [
    "Atelectasis",
    "Cardiomegaly",
    "Consolidation",
    "Edema",
    "Effusion",
    "Emphysema",
    "Fibrosis",
    "Hernia",
    "Infiltration",
    "Mass",
    "Nodule",
    "Pleural_Thickening",
    "Pneumonia",
    "Pneumothorax",
]


def _checkpoint_metadata(checkpoint: dict) -> dict:
    """Conserva solo evidencia escalar segura incluida en el checkpoint."""
    keys = ("phase", "epoch", "best_val_auc_macro", "best_val_map", "num_classes", "num_layers")
    return {
        key: checkpoint[key]
        for key in keys
        if key in checkpoint and isinstance(checkpoint[key], (str, int, float))
    }


def load_ensemble(artifacts_dir: str) -> dict:
    """
    Carga los dos modelos del ensemble y la configuracion.
    Llamar una sola vez en lifespan de FastAPI.
    """
    artifacts = Path(artifacts_dir)
    cfg_ens = json.loads((artifacts / "ensemble_config.json").read_text())
    cfg_mod = json.loads((artifacts / "model_config_14.json").read_text())
    thr     = json.loads((artifacts / "thresholds_14.json").read_text())["thresholds"]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model_v1 = CNNViT(
        backbone_weights=cfg_mod["backbone"],
        num_classes=cfg_mod["num_classes"],
        embedding_dim=cfg_mod["embedding_dim"],
        num_heads=cfg_mod["num_heads"],
        num_layers=cfg_mod["num_layers_v1"],
        mlp_dim=cfg_mod["mlp_dim"],
    ).to(device)
    ckpt_v1 = torch.load(artifacts / cfg_ens["checkpoint_v1"], map_location=device, weights_only=True)
    model_v1.load_state_dict(ckpt_v1["model_state_dict"])
    model_v1.eval()

    model_v2 = CNNViT(
        backbone_weights=cfg_mod["backbone"],
        num_classes=cfg_mod["num_classes"],
        embedding_dim=cfg_mod["embedding_dim"],
        num_heads=cfg_mod["num_heads"],
        num_layers=cfg_mod["num_layers_v2"],
        mlp_dim=cfg_mod["mlp_dim"],
    ).to(device)
    ckpt_v2 = torch.load(artifacts / cfg_ens["checkpoint_v2"], map_location=device, weights_only=True)
    model_v2.load_state_dict(ckpt_v2["model_state_dict"])
    model_v2.eval()

    return {
        "model_v1": model_v1,
        "model_v2": model_v2,
        "weight_v1": cfg_ens["weight_v1"],
        "weight_v2": cfg_ens["weight_v2"],
        "thresholds": thr,
        "device": device,
        "checkpoint_metrics": {
            "model_v1": _checkpoint_metadata(ckpt_v1),
            "model_v2": _checkpoint_metadata(ckpt_v2),
        },
    }


def _decision_support(
    probs: np.ndarray,
    probs_v1: np.ndarray,
    probs_v2: np.ndarray,
    thresholds: dict,
    predicted_class: str,
    argmax_idx: int,
) -> dict:
    """Resume consistencia interna sin presentarla como certeza clinica."""
    focus_idx = argmax_idx if predicted_class == "No Finding" else CLASSES_14.index(predicted_class)
    focus_class = CLASSES_14[focus_idx]
    probability = float(probs[focus_idx])
    threshold = float(thresholds.get(focus_class, 0.3))
    margin = abs(probability - threshold)
    disagreement = abs(float(probs_v1[focus_idx]) - float(probs_v2[focus_idx]))

    reasons: list[str] = []
    if disagreement >= 0.20:
        status = "discordant"
        reasons.append(
            f"Los dos modelos difieren {disagreement * 100:.1f} puntos porcentuales para {focus_class}."
        )
    elif margin <= 0.05 or disagreement >= 0.10:
        status = "borderline"
        if margin <= 0.05:
            reasons.append(
                f"El score de {focus_class} esta a {margin * 100:.1f} puntos porcentuales del umbral."
            )
        if disagreement >= 0.10:
            reasons.append(
                f"Los modelos difieren {disagreement * 100:.1f} puntos porcentuales para {focus_class}."
            )
    else:
        status = "stable"
        reasons.append("Los dos modelos muestran concordancia tecnica para la decision principal.")

    heightened = status != "stable"
    recommendation = (
        "Realizar revision radiologica reforzada antes de interpretar este resultado."
        if heightened
        else "Mantener la revision radiologica habitual y correlacionar con el contexto clinico."
    )
    return {
        "status": status,
        "method": "two_model_agreement_v1",
        "focus_class": focus_class,
        "ensemble_score": round(probability, 6),
        "threshold": round(threshold, 6),
        "threshold_margin": round(margin, 6),
        "model_disagreement": round(disagreement, 6),
        "requires_heightened_review": heightened,
        "calibrated_probability": False,
        "reasons": reasons,
        "recommendation": recommendation,
    }


def run_ensemble_inference(ensemble: dict, tensor: torch.Tensor) -> dict:
    """
    Inferencia con ensemble de dos modelos.
    Retorna probabilidades, clase principal y hallazgos positivos.
    predicted_label = -1 si No Finding (ninguna clase supera su threshold).
    """
    device = ensemble["device"]
    tensor = tensor.to(device)
    w1 = ensemble["weight_v1"]
    w2 = ensemble["weight_v2"]

    T = ensemble.get("temperature", 1.0)
    with torch.no_grad():
        probs_v1 = torch.sigmoid(ensemble["model_v1"](tensor) / T).cpu().numpy()[0]
        probs_v2 = torch.sigmoid(ensemble["model_v2"](tensor) / T).cpu().numpy()[0]

    probs = w1 * probs_v1 + w2 * probs_v2  # (14,)

    probs_dict = {CLASSES_14[i]: round(float(probs[i]), 6) for i in range(14)}

    argmax_idx   = int(np.argmax(probs))
    thresholds   = ensemble["thresholds"]

    _SUB_MIN = 0.10  # mínimo para hallazgo sub-umbral (vigilancia)

    positive_findings = [
        cls for cls in CLASSES_14
        if probs_dict[cls] >= thresholds.get(cls, 0.3)
    ]

    sub_threshold_findings = [
        {"class": cls, "probability": round(float(probs_dict[cls]), 4)}
        for cls in CLASSES_14
        if _SUB_MIN <= probs_dict[cls] < thresholds.get(cls, 0.3)
    ]

    if positive_findings:
        predicted_class = max(positive_findings, key=lambda c: probs_dict[c])
        predicted_label = CLASSES_14.index(predicted_class)
        confidence      = probs_dict[predicted_class]
    else:
        predicted_class = "No Finding"
        predicted_label = -1
        confidence      = round(float(1.0 - np.max(probs)), 6)

    decision_support = _decision_support(
        probs,
        probs_v1,
        probs_v2,
        thresholds,
        predicted_class,
        argmax_idx,
    )

    return {
        "predicted_class":       predicted_class,
        "predicted_label":       predicted_label,
        "confidence":            confidence,
        "probabilities":         probs_dict,
        "positive_findings":     positive_findings,
        "sub_threshold_findings": sub_threshold_findings,
        "argmax_label":          argmax_idx,
        "decision_support":      decision_support,
    }
