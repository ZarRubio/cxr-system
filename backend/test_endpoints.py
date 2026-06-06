import os
os.environ["CXR_SKIP_MODEL_LOAD"] = "true"

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# --- /health ---
r = client.get("/health")
assert r.status_code == 200, f"health status={r.status_code}"
h = r.json()
print("=== /health ===")
print(f"  status: {h['status']}")
print(f"  ensemble_loaded: {h['ensemble_loaded']}")
print(f"  num_classes: {h['num_classes']}")
print(f"  model_type: {h['model_type']}")

# --- /model-info ---
r2 = client.get("/model-info")
assert r2.status_code == 200, f"model-info status={r2.status_code}"
d = r2.json()
print("\n=== /model-info ===")
print(f"  type: {d['type']}")
print(f"  num_classes: {d['num_classes']}")
print(f"  task: {d['task']}")
print(f"  auc_macro: {d['auc_macro']}")
print(f"  val_auc_macro: {d['val_auc_macro']}")
print(f"  models: {d['models']}")
print(f"  weights: {d['weights']}")
print(f"  classes count: {len(d['classes'])}")
print(f"  thresholds count: {len(d['thresholds'])}")
assert len(d["classes"]) == 14, f"Expected 14 classes, got {len(d['classes'])}"
assert len(d["thresholds"]) == 14, f"Expected 14 thresholds, got {len(d['thresholds'])}"
assert d["auc_macro"] == 0.8045
assert d["type"] == "ensemble"

# --- POST /predict sin modelo (debe retornar 503) ---
import io
from PIL import Image
import numpy as np

img = Image.fromarray(np.random.randint(30, 200, (224, 224), dtype=np.uint8))
buf = io.BytesIO()
img.save(buf, format="PNG")
buf.seek(0)

r3 = client.post("/predict", files={"file": ("test.png", buf, "image/png")})
assert r3.status_code == 503, f"Expected 503 (no model), got {r3.status_code}: {r3.text}"
print("\n=== POST /predict (sin modelo) ===")
print(f"  status: {r3.status_code} (esperado 503 - modelo no cargado)")

print("\n--- TODOS LOS TESTS PASARON ---")
