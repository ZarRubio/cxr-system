# CXR Classifier — Sistema de clasificación de radiografías de tórax

**Hospital Nacional Arzobispo Loayza (HNAL) — Lima, Perú**
Tesis de Ingeniería de Software · 2026

## Descripción

Sistema de apoyo diagnóstico que clasifica radiografías de tórax en 4 categorías:
- No Finding (normal)
- Cardiomegaly (insuficiencia cardíaca)
- Effusion (derrame pleural)
- Infiltration (TB pulmonar / neumonía)

Basado en un modelo híbrido CNN-ViT (implementación propia) entrenado sobre
el dataset NIH ChestX-ray14.

## Stack

| Componente | Tecnología |
|---|---|
| Backend | FastAPI (Python 3.12) |
| Frontend | Streamlit |
| Modelo | CNN-ViT (DenseNet121 + Vision Transformer propio) |
| Formato de imagen | PNG, JPG, DICOM |
| Contenedores | Docker Compose |

## Configuración inicial

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/cxr-system
cd cxr-system
```

### 2. Descargar el modelo (paso manual)

Descarga el checkpoint desde Google Drive y colócalo en `backend/artifacts/`:

```
Drive: Tesis_CXR/experiments_s4/checkpoints/sprint4_phase2_best.pt
       ↓ renombrar a
Local: backend/artifacts/sprint3_model.pt
```

Los archivos JSON ya están en el repo (`thresholds.json`, `labels.json`, `model_config.json`).

### 3. Correr con Docker

```bash
docker-compose up --build
```

- Frontend: http://localhost:8501
- Backend API: http://localhost:8000/docs

### 4. Correr sin Docker (desarrollo)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (en otra terminal)
cd frontend
pip install -r requirements.txt
BACKEND_URL=http://localhost:8000 streamlit run app.py
```

### Variables de entorno utiles

- `CXR_CORS_ORIGINS`: lista separada por comas de origenes permitidos por CORS. Por defecto usa `*` para desarrollo local.
- `CXR_SKIP_MODEL_LOAD=1`: evita cargar el checkpoint real al iniciar la API. Se usa para tests con mocks, no para inferencia real.
- `CXR_RATE_LIMIT_PREDICT`: limite de requests para `/predict` y `/predict-batch` compatible con SlowAPI, por defecto `20/minute`.
- `CXR_AUDIT_LOG_PATH`: ruta del log JSONL de auditoria sin imagenes ni metadatos de paciente, por defecto `logs/audit.jsonl`.
- `BACKEND_URL`: URL del backend usada por Streamlit, validada con Pydantic Settings.

## Endpoints principales

- `POST /predict`: analiza una imagen.
- `POST /predict-batch`: analiza hasta 8 imagenes en un lote.
- `GET /model-info`: expone checkpoint, clases, thresholds y metricas.
- `GET /health`: expone estado del modelo, checkpoint, tiempo de carga y uptime.

`/predict` y `/predict-batch` aceptan `gradcam_method=gradcam|gradcam++|scorecam` y
`mc_passes=N` para incertidumbre por MC Dropout. Si `model_config.json` incluye
`temperature`, se aplica Temperature Scaling en inferencia.

## Estructura del proyecto

```
cxr-system/
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── routers/predict.py       # POST /predict
│   ├── services/                # model, gradcam, dicom
│   ├── schemas/prediction.py    # Pydantic models
│   ├── utils/image_utils.py     # preprocessing
│   └── artifacts/               # modelo + configs (modelo NO en git)
├── frontend/
│   ├── app.py                   # Streamlit app
│   └── components/              # uploader, results, gradcam, history
├── docker-compose.yml
└── README.md
```

## Disclaimer

> ⚠️ Este sistema es de uso exclusivamente académico.
> No reemplaza el criterio clínico del radiólogo.
