# Deploy en Google Cloud Run - CXR Classifier

> **Nota:** el deploy normal ocurre automáticamente vía `.github/workflows/deploy.yml`
> (con tests como gate) en cada push a `master`. Esta guía documenta el proceso manual
> equivalente, útil para debugging o el primer despliegue.

## Requisitos previos

1. Cuenta Google Cloud con proyecto creado
2. `gcloud` CLI instalado y autenticado
3. Docker instalado localmente

## 1. Configurar proyecto y región

```bash
gcloud config set project project-962d2332-8a63-46b3-92e
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

docker build -t us-central1-docker.pkg.dev/project-962d2332-8a63-46b3-92e/cxr/backend:latest .
docker push us-central1-docker.pkg.dev/project-962d2332-8a63-46b3-92e/cxr/backend:latest
```

## 4. Desplegar backend en Cloud Run

```bash
gcloud run deploy cxr-backend \
  --image us-central1-docker.pkg.dev/project-962d2332-8a63-46b3-92e/cxr/backend:latest \
  --region us-central1 \
  --cpu 2 \
  --memory 4Gi \
  --timeout 3600 \
  --concurrency 1 \
  --min-instances 1 \
  --max-instances 3 \
  --no-cpu-throttling \
  --allow-unauthenticated \
  --set-env-vars "CXR_CORS_ORIGINS=<URL-frontend>,CXR_API_KEY=<la-misma-key-que-el-frontend>"
```

Obtén las URLs asignadas por Cloud Run:

```bash
gcloud run services describe cxr-backend --region us-central1 --format='value(status.url)'
gcloud run services describe cxr-frontend --region us-central1 --format='value(status.url)'
```

## 5. Build y push del frontend (Next.js)

La URL del backend ya no se hornea en el bundle: se pasa como env var de runtime
(`BACKEND_URL`) porque el navegador solo habla con las rutas `/api` del propio frontend.

```bash
cd ../frontend-next

docker build \
  -t us-central1-docker.pkg.dev/project-962d2332-8a63-46b3-92e/cxr/frontend:latest \
  .

docker push us-central1-docker.pkg.dev/project-962d2332-8a63-46b3-92e/cxr/frontend:latest
```

## 6. Desplegar frontend en Cloud Run

```bash
gcloud run deploy cxr-frontend \
  --image us-central1-docker.pkg.dev/project-962d2332-8a63-46b3-92e/cxr/frontend:latest \
  --region us-central1 \
  --cpu 1 \
  --memory 512Mi \
  --timeout 60 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 3 \
  --allow-unauthenticated \
  --set-env-vars "HOSTNAME=0.0.0.0,BACKEND_URL=<URL-backend>,BACKEND_API_KEY=<la-misma-key-que-el-backend>,AUTH_SECRET=<openssl rand -base64 32>,AUTH_TRUST_HOST=true"
```

## 7. Verificación final

```bash
# Backend health
curl <URL-backend>/health

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
