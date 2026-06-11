# Deploy en Google Cloud Run - CXR Classifier

## Requisitos previos

1. Cuenta Google Cloud con proyecto creado
2. `gcloud` CLI instalado y autenticado
3. Docker instalado localmente

## 1. Configurar proyecto y región

```bash
gcloud config set project project-20fbf8b2-6971-4ef9-8b1
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

docker build -t us-central1-docker.pkg.dev/project-20fbf8b2-6971-4ef9-8b1/cxr/backend:latest .
docker push us-central1-docker.pkg.dev/project-20fbf8b2-6971-4ef9-8b1/cxr/backend:latest
```

## 4. Desplegar backend en Cloud Run

```bash
gcloud run deploy cxr-backend \
  --image us-central1-docker.pkg.dev/project-20fbf8b2-6971-4ef9-8b1/cxr/backend:latest \
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

Backend URL: `https://cxr-backend-55733445282.us-central1.run.app`

## 5. Build y push del frontend (Next.js)

El `NEXT_PUBLIC_BACKEND_URL` se bake en el bundle en tiempo de build — pásalo como `--build-arg`:

```bash
cd ../frontend-next

docker build \
  --build-arg NEXT_PUBLIC_BACKEND_URL=https://cxr-backend-55733445282.us-central1.run.app \
  -t us-central1-docker.pkg.dev/project-20fbf8b2-6971-4ef9-8b1/cxr/frontend:latest \
  .

docker push us-central1-docker.pkg.dev/project-20fbf8b2-6971-4ef9-8b1/cxr/frontend:latest
```

## 6. Desplegar frontend en Cloud Run

```bash
gcloud run deploy cxr-frontend \
  --image us-central1-docker.pkg.dev/project-20fbf8b2-6971-4ef9-8b1/cxr/frontend:latest \
  --region us-central1 \
  --cpu 1 \
  --memory 512Mi \
  --timeout 60 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 3 \
  --allow-unauthenticated
```

## 7. Verificación final

```bash
# Backend health
curl https://cxr-backend-55733445282.us-central1.run.app/health

# Frontend URL
gcloud run services describe cxr-frontend --region us-central1 --format='value(status.url)'
```

## Parámetros clave explicados

| Parámetro | Valor | Por qué |
|---|---|---|
| `--cpu 2` | 2 vCPU backend | DenseNet121 + Grad-CAM necesitan CPU real |
| `--memory 4Gi` | 4 GB backend | Modelo + activaciones Grad-CAM en CPU |
| `--timeout 3600` | 1 hora backend | Grad-CAM puede tardar minutos en CPU |
| `--concurrency 1` | 1 request backend | El modelo no es thread-safe con Grad-CAM |
| `--min-instances 1` | Backend siempre activo | Evita cold start en la demo de tesis |
| `--no-cpu-throttling` | CPU dedicada backend | Sin esto Cloud Run reduce CPU cuando idle |
| `--memory 512Mi` | Frontend ligero | Next.js standalone no necesita más |
| `--concurrency 80` | Frontend multi-request | Next.js maneja requests concurrentes sin problema |
