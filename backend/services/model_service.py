"""
Carga dos modelos CNN-ViT y realiza inferencia en ensemble.
"""
import json
import numpy as np
import torch
import cv2
from pathlib import Path

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
    ckpt_v1 = torch.load(artifacts / cfg_ens["checkpoint_v1"], map_location=device)
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
    ckpt_v2 = torch.load(artifacts / cfg_ens["checkpoint_v2"], map_location=device)
    model_v2.load_state_dict(ckpt_v2["model_state_dict"])
    model_v2.eval()

    return {
        "model_v1": model_v1,
        "model_v2": model_v2,
        "weight_v1": cfg_ens["weight_v1"],
        "weight_v2": cfg_ens["weight_v2"],
        "thresholds": thr,
        "device": device,
    }


def preprocess_image(img_array: np.ndarray, image_size: int = 224) -> torch.Tensor:
    """
    (H,W) uint8 -> (1,1,224,224) float32 en [-1024,1024].
    CRITICO: normalizacion xrv, NO ImageNet.
    """
    img = img_array.astype(np.float32)
    img = (img / 255.0) * 2048.0 - 1024.0
    img = cv2.resize(img, (image_size, image_size))
    return torch.from_numpy(img).unsqueeze(0).unsqueeze(0)  # (1,1,224,224)


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

    with torch.no_grad():
        probs_v1 = torch.sigmoid(ensemble["model_v1"](tensor)).cpu().numpy()[0]
        probs_v2 = torch.sigmoid(ensemble["model_v2"](tensor)).cpu().numpy()[0]

    probs = w1 * probs_v1 + w2 * probs_v2  # (14,)

    probs_dict = {CLASSES_14[i]: round(float(probs[i]), 6) for i in range(14)}

    argmax_idx   = int(np.argmax(probs))
    thresholds   = ensemble["thresholds"]

    positive_findings = [
        cls for cls in CLASSES_14
        if probs_dict[cls] >= thresholds.get(cls, 0.3)
    ]

    if positive_findings:
        predicted_class = max(positive_findings, key=lambda c: probs_dict[c])
        predicted_label = CLASSES_14.index(predicted_class)
        confidence      = probs_dict[predicted_class]
    else:
        predicted_class = "No Finding"
        predicted_label = -1
        confidence      = round(float(1.0 - np.max(probs)), 6)

    return {
        "predicted_class":   predicted_class,
        "predicted_label":   predicted_label,
        "confidence":        confidence,
        "probabilities":     probs_dict,
        "positive_findings": positive_findings,
        "argmax_label":      argmax_idx,
    }
