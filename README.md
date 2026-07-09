# CXR Classifier — Sistema de clasificación de radiografías de tórax

[![Deploy to Cloud Run](https://github.com/ZarRubio/cxr-system/actions/workflows/deploy.yml/badge.svg)](https://github.com/ZarRubio/cxr-system/actions/workflows/deploy.yml)
![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)

**Hospital Nacional Arzobispo Loayza (HNAL) — Lima, Perú**
Tesis de Ingeniería de Software · 2026

## Descripción

Sistema de apoyo diagnóstico que clasifica radiografías de tórax en **14 patologías** usando
un ensemble de dos modelos híbridos CNN-ViT entrenados sobre el dataset NIH ChestX-ray14,
con mapas de calor explicativos (Grad-CAM) y reportes PDF.

| | | |
|---|---|---|
| Atelectasis | Effusion | Mass |
| Cardiomegaly | Emphysema | Nodule |
| Consolidation | Fibrosis | Pleural Thickening |
| Edema | Hernia | Pneumonia |
| Infiltration | | Pneumothorax |

Cuando ninguna clase supera su umbral, el sistema reporta **No Finding**.

## Producción

| Servicio | URL |
|---|---|
| Frontend | <https://cxr-frontend-55733445282.us-central1.run.app> |
| Backend (health) | <https://cxr-backend-55733445282.us-central1.run.app/health> |

## Arquitectura

```
┌──────────┐   sesión NextAuth    ┌──────────────────┐   X-API-Key    ┌─────────────────┐
│ Navegador ├─────────────────────► Next.js (rutas    ├────────────────► FastAPI backend │
│ (es-PE)  │   /api/predict etc.  │ /api proxy + UI)  │  BACKEND_URL   │ ensemble CNN-ViT│
└──────────┘                      └────────┬─────────┘                └─────────────────┘
                                           │ SQLite (usuarios)
                                           ▼
                                      data/cxr.db
```

- **El navegador nunca llama al backend directamente.** Las rutas `/api/*` de Next.js validan
  la sesión y reenvían al backend con el header `X-API-Key`.
- El backend rechaza con 401 cualquier request sin la key cuando `CXR_API_KEY` está configurada
  (`/health` queda abierto para monitoreo).
- **Persistencia** (`DATA_BACKEND`): en desarrollo y docker-compose, SQLite (`data/cxr.db`);
  en Cloud Run, **Firestore** (colecciones `users` y `analyses`) — los usuarios creados en
  `/admin`, el historial clínico y las validaciones sobreviven reinicios. El admin se siembra
  automáticamente (`SEED_ADMIN_PASSWORD`, default `hnal2026` — cambiarla en producción).
- **Historial clínico**: cada análisis se persiste server-side (metadatos del estudio, scores
  y severidad; nunca la imagen ni el Grad-CAM). Cada radiólogo ve los suyos; el admin ve todos.
- **Validación del radiólogo**: sobre cada análisis se registra concordancia o discrepancia
  (con el hallazgo real) — la métrica de concordancia clínica del sistema. Exportable a CSV/JSON
  desde el historial.
- **Metadatos DICOM pseudonimizados**: de los archivos `.dcm` se extraen solo edad, sexo,
  proyección (ViewPosition) y un hash del StudyInstanceUID — nombre, ID de paciente y fechas
  nunca se leen (Ley 29733). Aparecen en el análisis, el historial y el reporte PDF.
- **Triage por lote** (`/batch`): hasta 8 placas por pasada, resultados ordenados por severidad
  (críticos primero) para priorizar la lectura; cada análisis queda en el historial.
- **Panel de estadísticas** (`/admin/stats`, solo admin): volumen diario, distribución por
  severidad y hallazgo, actividad y concordancia por radiólogo, discrepancias recientes, con
  filtros por rango de fechas (también disponibles en el historial).

## Stack

| Componente | Tecnología |
|---|---|
| Backend | FastAPI · Python 3.12 |
| Frontend | Next.js 16 · React 19 · Tailwind 4 · NextAuth v5 (puerto 3000) |
| Persistencia | SQLite (dev/compose) · Firestore vía REST (Cloud Run) |
| Modelo | Ensemble CNN-ViT: DenseNet121 backbone + Vision Transformer propio |
| Formatos de imagen | PNG, JPG, DICOM |
| Visualización | Grad-CAM / Grad-CAM++ / Score-CAM |
| CI/CD | GitHub Actions (tests + lint gating) → Google Cloud Run |
| Contenedores | Docker (build independiente por servicio, usuarios no-root) |

## Modelo ensemble

| | Model v1 | Model v2 |
|---|---|---|
| Checkpoint | `sprint4ml_v1.pt` | `sprint4ml_v2.pt` |
| Capas ViT | 4 | 6 |
| Peso en ensemble | 0.3 | 0.7 |

- **AUC macro (test):** 0.8045 · **AUC macro (validación):** 0.7950 · Referencia Wang et al. 2017: 0.7452
- Inferencia: promedio ponderado de sigmoid scores; umbral per-clase (Infiltration y Pneumonia usan 0.25 por alta incidencia TB en HNAL).

## Configuración inicial

### 1. Clonar y descargar artefactos

```bash
git clone https://github.com/ZarRubio/cxr-system
cd cxr-system
```

Los checkpoints **no están en git**. Descárgalos a `backend/artifacts/`:
`sprint4ml_v1.pt`, `sprint4ml_v2.pt`, `ensemble_config.json`, `model_config_14.json`,
`thresholds_14.json`, `labels_14.json`. En producción se descargan desde GCS en el CI/CD
(bucket `cxr-model-artifacts-55733445282`).

### 2. Desarrollo (sin Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt -r requirements-dev.txt
uvicorn main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend-next
cp .env.local.example .env.local   # editar BACKEND_URL=http://localhost:8000
npm install
npm run dev          # http://localhost:3000 — login inicial: admin / hnal2026
```

### 3. Docker Compose

```bash
docker compose up --build
# backend en :8000, frontend en :3000; usuarios persisten en el volumen frontend-data
```

## Variables de entorno

### Backend (prefijo `CXR_`)

| Variable | Default | Descripción |
|---|---|---|
| `CXR_CORS_ORIGINS` | `http://localhost:3000` | Orígenes CORS separados por comas |
| `CXR_API_KEY` | *(vacía)* | Si se define, `/predict*` y `/model-info` exigen header `X-API-Key` |
| `CXR_SKIP_MODEL_LOAD` | `0` | `1` para tests/mocks (no carga checkpoints) |
| `CXR_RATE_LIMIT_PREDICT` | `20/minute` | Límite SlowAPI por IP (usa `X-Forwarded-For` del proxy) |
| `CXR_AUDIT_LOG_PATH` | `logs/audit.jsonl` | Log JSONL de auditoría (sin imágenes ni datos de paciente) |
| `CXR_MAX_UPLOAD_MB` | `15` | Tamaño máximo de imagen |
| `CXR_MAX_IMAGE_DIM` | `8192` | Dimensión máxima (px) — protege contra OOM |
| `CXR_CACHE_MAX_ENTRIES` | `20` | Entradas del caché LRU de predicciones |
| `CXR_BATCH_MAX_FILES` | `8` | Imágenes máximas por lote |

### Frontend

| Variable | Descripción |
|---|---|
| `BACKEND_URL` | URL del backend (server-side; el navegador no la ve) |
| `BACKEND_API_KEY` | Key enviada al backend como `X-API-Key` |
| `AUTH_SECRET` | Secreto NextAuth — **obligatorio en producción** (`openssl rand -base64 32`) |
| `AUTH_URL` | URL pública de la app — **obligatoria en el server standalone** (Docker/Cloud Run); sin ella los redirects de auth apuntan a `0.0.0.0:3000` |
| `AUTH_TRUST_HOST` | `true` detrás de un proxy (Cloud Run/Docker); sin ella NextAuth v5 lanza `UntrustedHost` |
| `SEED_ADMIN_PASSWORD` | Contraseña del admin sembrado (default `hnal2026`) |
| `DATA_BACKEND` | `sqlite` (default) o `firestore` (producción, requiere correr en GCP) |
| `GOOGLE_CLOUD_PROJECT` | Proyecto GCP para Firestore (en Cloud Run se autodetecta) |
| `CXR_DATA_DIR` | Directorio de la BD SQLite (default `./data`) |

## Endpoints del backend

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/predict` | `X-API-Key` | Clasificación de una imagen |
| `POST` | `/predict-batch` | `X-API-Key` | Hasta 8 imágenes por lote |
| `GET` | `/model-info` | `X-API-Key` | Arquitectura, umbrales y métricas AUC |
| `GET` | `/health` | — | Estado, versión, uptime, caché |

Query params de `/predict*`: `gradcam_method` (`gradcam`·`gradcam++`·`scorecam`) e
`include_gradcam` (`true`/`false`). Toda respuesta incluye header `X-Request-ID`.

## Tests

```bash
# Backend: 80 tests
cd backend
CXR_SKIP_MODEL_LOAD=1 python -m pytest tests/ -q
python -m ruff check .

# Frontend
cd frontend-next
npm run lint && npx tsc --noEmit && npm run build
```

## Despliegue (CI/CD)

- **`ci.yml`**: en cada PR — ruff + pytest (backend), eslint + tsc + build (frontend).
- **`deploy.yml`**: en cada push a `master` — corre CI como gate, descarga checkpoints de GCS,
  construye imágenes, publica en Artifact Registry y despliega a Cloud Run (`us-central1`).

Secrets requeridos en el repositorio de GitHub:

| Secret | Cómo generarlo |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | (ya configurado) |
| `GCP_SERVICE_ACCOUNT` | (ya configurado) |
| `CXR_API_KEY` | `openssl rand -hex 32` |
| `AUTH_SECRET` | `openssl rand -base64 32` |

Además, los artefactos del modelo deben existir en el bucket y la cuenta de servicio
del deploy necesita permiso de lectura sobre él:

```bash
gcloud storage cp backend/artifacts/{sprint4ml_v1.pt,sprint4ml_v2.pt,ensemble_config.json,model_config_14.json,thresholds_14.json,labels_14.json} \
  gs://cxr-model-artifacts-55733445282/artifacts/

gcloud storage buckets add-iam-policy-binding gs://cxr-model-artifacts-55733445282 \
  --member="serviceAccount:github-actions@project-20fbf8b2-6971-4ef9-8b1.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

## Estructura del proyecto

```
cxr-system/
├── backend/
│   ├── main.py                     # FastAPI app + lifespan + /health + /model-info
│   ├── settings.py                 # Configuración central (prefijo CXR_)
│   ├── auth.py                     # Validación de X-API-Key
│   ├── middleware.py               # Request-ID + access log JSON
│   ├── routers/predict.py          # Endpoints (capa fina)
│   ├── services/
│   │   ├── prediction_service.py   # Pipeline: validar → decodificar → inferir → responder
│   │   ├── model_service.py        # load_ensemble, run_ensemble_inference
│   │   ├── gradcam_service.py      # Grad-CAM / Grad-CAM++ / Score-CAM
│   │   ├── dicom_service.py        # Extracción de píxeles DICOM
│   │   └── audit_service.py        # Log JSONL de auditoría
│   ├── constants/clinical_text.py  # Disclaimers y explicaciones clínicas
│   ├── utils/                      # image_utils, cache (LRU thread-safe)
│   ├── models/cnn_vit.py           # Arquitectura CNN-ViT
│   ├── schemas/prediction.py       # Modelos Pydantic
│   ├── tests/                      # 80 tests
│   └── Dockerfile                  # non-root, pre-descarga de pesos
├── frontend-next/
│   ├── app/                        # Páginas + rutas /api (proxy autenticado)
│   ├── lib/                        # api, backend (proxy), db (SQLite), user-store, pdf
│   ├── components/                 # analyze/, layout/, ui/
│   └── Dockerfile                  # multi-stage, non-root, standalone
├── .github/workflows/              # ci.yml + deploy.yml
└── docker-compose.yml
```

## Disclaimer

> Este sistema es de uso exclusivamente académico.
> No reemplaza el criterio clínico del radiólogo.
> Desarrollado para el Hospital Nacional Arzobispo Loayza (HNAL), Lima, Perú.
