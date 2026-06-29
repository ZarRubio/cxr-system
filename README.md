# CXR Classifier — Sistema de clasificación de radiografías de tórax

**Hospital Nacional Arzobispo Loayza (HNAL) — Lima, Perú**  
Tesis de Ingeniería de Software · 2026

## Descripción

Sistema de apoyo diagnóstico que clasifica radiografías de tórax en **14 patologías** usando
un ensemble de dos modelos híbridos CNN-ViT entrenados sobre el dataset NIH ChestX-ray14.

| Clase | Clase |
|---|---|
| Atelectasis | Mass |
| Cardiomegaly | Nodule |
| Consolidation | Pleural Thickening |
| Edema | Pneumonia |
| Effusion | Pneumothorax |
| Emphysema | — |
| Fibrosis | — |
| Hernia | — |
| Infiltration | — |

Cuando ninguna clase supera su umbral, el sistema reporta **No Finding**.

## Stack

| Componente | Tecnología |
|---|---|
| Backend | FastAPI · Python 3.12 |
| Frontend | Next.js (puerto 3000) |
| Modelo | Ensemble CNN-ViT: DenseNet121 backbone + Vision Transformer propio |
| Formatos de imagen | PNG, JPG, DICOM |
| Visualización | Grad-CAM / Grad-CAM++ / Score-CAM |
| CI/CD | GitHub Actions → Google Cloud Run |
| Contenedores | Docker (build independiente por servicio) |

## Modelo ensemble

| | Model v1 | Model v2 |
|---|---|---|
| Checkpoint | `sprint4ml_v1.pt` | `sprint4ml_v2.pt` |
| Capas ViT | 4 | 6 |
| Peso en ensemble | 0.3 | 0.7 |

- **AUC macro (test):** 0.8045  
- **AUC macro (validación):** 0.7950  
- **Referencia Wang et al. 2017:** 0.7452  
- Inferencia: promedio ponderado de sigmoid scores; umbral per-clase (Infiltration y Pneumonia usan 0.25 por alta incidencia TB en HNAL).

## Configuración inicial

### 1. Clonar el repositorio

```bash
git clone https://github.com/ZarRubio/cxr-system
cd cxr-system
```

### 2. Descargar artefactos del modelo

Los checkpoints **no están en git**. Descárgalos a `backend/artifacts/`:

```
sprint4ml_v1.pt
sprint4ml_v2.pt
ensemble_config.json
model_config_14.json
thresholds_14.json
labels_14.json
```

En producción se descargan automáticamente desde GCS en el paso de CI/CD.

### 3. Correr en desarrollo (sin Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (en otra terminal)
cd frontend-next
npm install
npm run dev          # http://localhost:3000
```

### 4. Correr con Docker

```bash
# Backend
docker build -t cxr-backend ./backend
docker run -p 8000:8000 -v $(pwd)/backend/artifacts:/app/artifacts cxr-backend

# Frontend
docker build --build-arg NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 \
             -t cxr-frontend ./frontend-next
docker run -p 3000:3000 cxr-frontend
```

### Variables de entorno — Backend

| Variable | Por defecto | Descripción |
|---|---|---|
| `CXR_CORS_ORIGINS` | `*` | Orígenes CORS separados por comas |
| `CXR_SKIP_MODEL_LOAD` | `0` | Poner `1` para tests/mocks (no carga checkpoints reales) |
| `CXR_RATE_LIMIT_PREDICT` | `20/minute` | Límite SlowAPI para `/predict` y `/predict-batch` |
| `CXR_AUDIT_LOG_PATH` | `logs/audit.jsonl` | Log JSONL de auditoría (sin imágenes ni metadatos de paciente) |

### Variables de entorno — Frontend

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | URL base del backend (ej. `http://localhost:8000`) |

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/predict` | Clasificación de una imagen |
| `POST` | `/predict-batch` | Hasta 8 imágenes en un lote |
| `GET` | `/health` | Estado del ensemble, uptime y errores de startup |
| `GET` | `/model-info` | Arquitectura, pesos, umbrales y métricas AUC |

### Parámetros query opcionales para `/predict` y `/predict-batch`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `gradcam_method` | `gradcam` · `gradcam++` · `scorecam` | `gradcam` |
| `mc_passes` | `1`–`20` | `1` |
| `include_gradcam` | `true` · `false` | `true` |

### Esquema de respuesta de `/predict`

```json
{
  "predicted_class": "Effusion",
  "predicted_label": 4,
  "confidence": 0.912,
  "probabilities": { "Atelectasis": 0.08, "Effusion": 0.91, "..." : "..." },
  "positive_findings": ["Effusion"],
  "sub_threshold_findings": [{ "class": "Infiltration", "probability": 0.18 }],
  "gradcam_image": "data:image/png;base64,...",
  "gradcam_class": "Effusion",
  "processing_time_ms": 320.5,
  "disclaimer": "Uso academico. No reemplaza el criterio clinico del radiologo...",
  "model_version": "ensemble-v1v2-14classes",
  "image_hash": "sha256hex...",
  "cached": false,
  "image_warnings": [],
  "uncertainty_std": null,
  "explanation": { "summary": "...", "visual": "...", "clinical": "..." }
}
```

## Tests

```bash
cd backend
../venv/Scripts/python.exe -m pytest tests/test_predict.py -v
```

**68 tests — 0 fallos.** Cobertura:

- `utils.image_utils` — detect_format, preprocess_for_model, validate_source_channels
- `services.dicom_service` — extracción de píxeles, MONOCHROME1/2, rescale+window
- `services.model_service` — run_ensemble_inference (No Finding, hallazgos positivos, ponderación)
- `routers.predict` helpers — validación de tamaño, mc_passes, gradcam_method, image_warnings
- Endpoints `/health`, `/model-info`, `/predict`, `/predict-batch` vía TestClient con mock ensemble

## Despliegue (CI/CD)

Cada push a `master` dispara el workflow `.github/workflows/deploy.yml`:

1. Descarga checkpoints y configs desde **Google Cloud Storage**.
2. Construye imágenes Docker y las publica en **Artifact Registry**.
3. Despliega backend y frontend en **Google Cloud Run** (región `us-central1`).

```
Backend:  https://cxr-backend-55733445282.us-central1.run.app
Frontend: Cloud Run · puerto 3000
```

Requiere los secrets `GCP_WORKLOAD_IDENTITY_PROVIDER` y `GCP_SERVICE_ACCOUNT` en el repositorio.

## Estructura del proyecto

```
cxr-system/
├── backend/
│   ├── main.py                   # FastAPI app + lifespan + /health + /model-info
│   ├── routers/predict.py        # POST /predict y /predict-batch
│   ├── services/
│   │   ├── model_service.py      # load_ensemble, run_ensemble_inference
│   │   ├── gradcam_service.py    # Grad-CAM / Grad-CAM++ / Score-CAM
│   │   ├── dicom_service.py      # extracción de píxeles DICOM
│   │   └── audit_service.py      # log JSONL de auditoría
│   ├── models/cnn_vit.py         # arquitectura CNN-ViT
│   ├── schemas/prediction.py     # Pydantic: PredictionResponse, BatchPredictionResponse
│   ├── utils/image_utils.py      # detect_format, preprocess_for_model, validate_source_channels
│   ├── tests/test_predict.py     # 68 tests unitarios e integración
│   ├── artifacts/                # checkpoints + configs JSON (NO en git)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend-next/                # Next.js
├── .github/workflows/deploy.yml  # CI/CD → Cloud Run
└── README.md
```

## Disclaimer

> Este sistema es de uso exclusivamente académico.
> No reemplaza el criterio clínico del radiólogo.
> Desarrollado para el Hospital Nacional Arzobispo Loayza (HNAL), Lima, Perú.
