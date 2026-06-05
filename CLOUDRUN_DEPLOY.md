# Deploy en Google Cloud Run - CXR Classifier

## Requisitos previos

1. Cuenta Google Cloud con proyecto creado
2. `gcloud` CLI instalado y autenticado
3. Docker instalado localmente

## 1. Configurar proyecto y región

```bash
gcloud config set project TU_PROJECT_ID
gcloud config set run/region us-central1

# Habilitar APIs necesarias
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

## 2. Crear repositorio de imágenes Docker

```bash
gcloud artifacts repositories create cxr \
  --repository-format=docker \
  --location=us-central1 \
  --description="CXR Classifier images"

# Autenticar Docker con Google
gcloud auth configure-docker us-central1-docker.pkg.dev
```

## 3. Build y push del backend

```bash
cd backend

docker build -t us-central1-docker.pkg.dev/TU_PROJECT_ID/cxr/backend:latest .
docker push us-central1-docker.pkg.dev/TU_PROJECT_ID/cxr/backend:latest
```

## 4. Desplegar backend en Cloud Run

```bash
gcloud run deploy cxr-backend \
  --image us-central1-docker.pkg.dev/TU_PROJECT_ID/cxr/backend:latest \
  --region us-central1 \
  --cpu 2 \
  --memory 4Gi \
  --timeout 3600 \
  --concurrency 1 \
  --min-instances 1 \
  --max-instances 3 \
  --no-cpu-throttling \
  --allow-unauthenticated \
  --set-env-vars "CXR_MODEL_CHECKPOINT=sprint3_model.pt,CXR_CORS_ORIGINS=*,DRIVE_FILE_ID=TU_DRIVE_FILE_ID"
```

Copia la URL pública del backend que muestra el comando (formato: `https://cxr-backend-xxxx-uc.a.run.app`).

Verifica:
```bash
curl https://cxr-backend-xxxx-uc.a.run.app/health
```

## 5. Build y push del frontend

```bash
cd ../frontend

docker build -t us-central1-docker.pkg.dev/TU_PROJECT_ID/cxr/frontend:latest .
docker push us-central1-docker.pkg.dev/TU_PROJECT_ID/cxr/frontend:latest
```

## 6. Desplegar frontend en Cloud Run

Reemplaza la URL del backend con la que obtuviste en el paso 4:

```bash
gcloud run deploy cxr-frontend \
  --image us-central1-docker.pkg.dev/TU_PROJECT_ID/cxr/frontend:latest \
  --region us-central1 \
  --cpu 1 \
  --memory 1Gi \
  --timeout 3600 \
  --min-instances 1 \
  --max-instances 2 \
  --session-affinity \
  --allow-unauthenticated \
  --set-env-vars "BACKEND_URL=https://cxr-backend-xxxx-uc.a.run.app"
```

## 7. Verificación final

```bash
# Backend health
curl https://cxr-backend-xxxx-uc.a.run.app/health

# Frontend (abrir en navegador)
echo "Frontend: $(gcloud run services describe cxr-frontend --region us-central1 --format='value(status.url)')"
```

## Parámetros clave explicados

| Parámetro | Valor | Por qué |
|---|---|---|
| `--cpu 2` | 2 vCPU backend | DenseNet121 + Grad-CAM necesitan CPU real |
| `--memory 4Gi` | 4 GB backend | Modelo + activaciones Grad-CAM en CPU |
| `--timeout 3600` | 1 hora | Grad-CAM puede tardar minutos en CPU |
| `--concurrency 1` | 1 request a la vez | El modelo no es thread-safe con Grad-CAM |
| `--min-instances 1` | Siempre activo | Evita cold start en la demo de tesis |
| `--no-cpu-throttling` | CPU dedicada | Sin esto Cloud Run reduce CPU cuando idle |
| `--session-affinity` | Frontend sticky | Streamlit necesita que el WebSocket vaya al mismo contenedor |

## Actualizar BACKEND_URL en Railway (si quieres mantener Railway para frontend)

Si prefieres mantener el frontend en Railway y solo mover el backend a Cloud Run:

En Railway, servicio frontend → Variables:
```
BACKEND_URL=https://cxr-backend-xxxx-uc.a.run.app
```

## Costos estimados (Google Cloud)

- Free tier: 2M requests/mes + 360,000 GB-seg de CPU
- Con min-instances=1 (siempre activo): ~$8-15/mes dependiendo del uso
- Para demo de tesis (uso bajo): probablemente dentro del free tier o mínimo costo
