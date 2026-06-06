"""
Validacion de logica de inferencia ensemble sin necesidad de servidor.
Usa modelos sinteticos (pesos aleatorios) en CPU para verificar el pipeline.
"""
import os
os.environ["CXR_SKIP_MODEL_LOAD"] = "true"

import sys
import numpy as np
import torch

sys.path.insert(0, ".")

# --- 1. Verificar CLASSES_14 ---
from services.model_service import CLASSES_14, preprocess_image, run_ensemble_inference
assert len(CLASSES_14) == 14
print(f"[OK] CLASSES_14: {len(CLASSES_14)} clases")
assert CLASSES_14[0] == "Atelectasis" and CLASSES_14[13] == "Pneumothorax"
print(f"[OK] Orden canonico correcto: {CLASSES_14[0]}..{CLASSES_14[13]}")

# --- 2. Verificar preprocess_image ---
img = np.random.randint(0, 255, (512, 512), dtype=np.uint8)
tensor = preprocess_image(img)
assert tensor.shape == (1, 1, 224, 224), f"Shape inesperado: {tensor.shape}"
assert tensor.min().item() >= -1024.0 and tensor.max().item() <= 1024.0, "Rango xrv incorrecto"
print(f"[OK] preprocess_image: {tensor.shape}, rango [{tensor.min():.1f}, {tensor.max():.1f}]")

# --- 3. Simular ensemble con modelos sinteticos ---
from models.cnn_vit import CNNViT

# Crear modelos minimalistas (4 y 6 capas) con pesos aleatorios
# (backbone_weights="" para evitar descargar pesos de torchxrayvision)
import torchxrayvision as xrv
densenet = xrv.models.DenseNet(weights="densenet121-res224-nih")

class FakeEnsemble:
    """Simula el dict ensemble sin cargar checkpoints reales."""
    def __init__(self):
        # Usamos modelos con la misma arquitectura pero pesos aleatorios
        self.model_v1 = CNNViT(num_classes=14, num_layers=4)
        self.model_v2 = CNNViT(num_classes=14, num_layers=6)
        self.model_v1.eval()
        self.model_v2.eval()

    def as_dict(self, thresholds):
        return {
            "model_v1": self.model_v1,
            "model_v2": self.model_v2,
            "weight_v1": 0.3,
            "weight_v2": 0.7,
            "thresholds": thresholds,
            "device": torch.device("cpu"),
        }

thresholds = {
    "Atelectasis": 0.3, "Cardiomegaly": 0.3, "Consolidation": 0.3,
    "Edema": 0.3, "Effusion": 0.3, "Emphysema": 0.3, "Fibrosis": 0.3,
    "Hernia": 0.3, "Infiltration": 0.25, "Mass": 0.3, "Nodule": 0.3,
    "Pleural_Thickening": 0.3, "Pneumonia": 0.25, "Pneumothorax": 0.3,
}

print("[..] Construyendo modelos sinteticos (puede tardar ~15s por descarga backbone)...")
fake = FakeEnsemble()
ensemble = fake.as_dict(thresholds)
print("[OK] Modelos sinteticos creados")

# --- 4. run_ensemble_inference ---
result = run_ensemble_inference(ensemble, tensor)

required_keys = {"predicted_class", "predicted_label", "confidence", "probabilities", "positive_findings", "argmax_label"}
assert required_keys.issubset(result.keys()), f"Faltan claves: {required_keys - result.keys()}"
assert len(result["probabilities"]) == 14, f"Esperaba 14 probs, hay {len(result['probabilities'])}"
assert all(0.0 <= v <= 1.0 for v in result["probabilities"].values()), "Probs fuera de [0,1]"
assert 0 <= result["argmax_label"] <= 13

print(f"[OK] run_ensemble_inference:")
print(f"     predicted_class: {result['predicted_class']}")
print(f"     predicted_label: {result['predicted_label']}")
print(f"     confidence: {result['confidence']:.4f}")
print(f"     positive_findings: {result['positive_findings']}")
print(f"     argmax_label: {result['argmax_label']}")

# --- 5. Caso No Finding (forzar todas las probs < threshold) ---
with torch.no_grad():
    # Sobreescribir logits para que sigmoid sea ~0.1 (< todos los thresholds)
    def patch_model(model):
        def forward_low(x):
            return torch.full((x.shape[0], 14), -2.2)  # sigmoid(-2.2) ~ 0.10
        model.forward = forward_low
    patch_model(ensemble["model_v1"])
    patch_model(ensemble["model_v2"])

result_nf = run_ensemble_inference(ensemble, tensor)
assert result_nf["predicted_class"] == "No Finding", f"Esperaba No Finding, got {result_nf['predicted_class']}"
assert result_nf["predicted_label"] == -1, f"Esperaba -1, got {result_nf['predicted_label']}"
assert result_nf["positive_findings"] == []
print(f"[OK] No Finding: predicted_label={result_nf['predicted_label']}, positive_findings=[]")

# --- 6. PredictionResponse con 14 clases ---
from schemas.prediction import PredictionResponse
resp = PredictionResponse(
    predicted_class="Effusion",
    predicted_label=4,
    confidence=0.72,
    probabilities={c: 0.1 for c in CLASSES_14},
    positive_findings=["Effusion", "Infiltration"],
    gradcam_image="data:image/png;base64,abc",
    gradcam_class="Effusion",
    processing_time_ms=150.0,
    disclaimer="Test",
    model_version="ensemble-v1v2-14classes",
)
assert resp.model_version == "ensemble-v1v2-14classes"
assert len(resp.probabilities) == 14
print(f"[OK] PredictionResponse: {resp.predicted_class}, {len(resp.probabilities)} probs, mv={resp.model_version}")

# --- 7. main.py LABELS_14 y AUC_METRICS ---
from main import LABELS_14, AUC_METRICS
assert len(LABELS_14) == 14
assert len(AUC_METRICS) == 14
assert LABELS_14["4"] == "Effusion"
assert LABELS_14["13"] == "Pneumothorax"
print(f"[OK] main.py: LABELS_14={len(LABELS_14)}, AUC_METRICS={len(AUC_METRICS)}")

print("\n=== TODOS LOS TESTS PASARON ===")
