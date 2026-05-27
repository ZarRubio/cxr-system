# Deploy En Railway - CXR Classifier

Esta guia asume que el backend y el frontend se despliegan como dos servicios separados dentro del mismo proyecto Railway.

## 1. Compartir El Modelo En Google Drive

1. Sube o ubica el checkpoint del modelo, por ejemplo:
   `Tesis_CXR/experiments_s4/checkpoints/sprint4_phase2_best.pt`
2. En Google Drive, abre **Compartir**.
3. Cambia el acceso a **Cualquier persona con el enlace** y rol **Espectador**.
4. Copia el enlace. Tendra un formato parecido a:

   ```text
   https://drive.google.com/file/d/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/view
   ```

5. Copia solo el ID:

   ```text
   XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

Ese valor se usara como `DRIVE_FILE_ID` en Railway.

## 2. Archivos Ya Preparados En Este Repo

El backend tiene:

- `backend/startup.sh`: descarga el checkpoint si no existe y arranca FastAPI.
- `backend/Dockerfile`: instala dependencias, precarga TorchXRayVision y ejecuta `startup.sh`.
- `backend/requirements.txt`: incluye `gdown`.

El frontend tiene:

- `frontend/Dockerfile`: arranca Streamlit usando el `$PORT` que inyecta Railway.
- `frontend/settings.py`: lee `BACKEND_URL`.

## 3. Variables De Entorno

### Backend

Configura estas variables en el servicio backend de Railway:

```text
DRIVE_FILE_ID=1CT-4i7FicHUlteWBu7w9SyQyKTZPlYkL
PORT=8000
CXR_CORS_ORIGINS=*
CXR_MODEL_CHECKPOINT=sprint3_model.pt
CXR_RATE_LIMIT_PREDICT=20/minute
CXR_AUDIT_LOG_PATH=logs/audit.jsonl
```

Notas:

- Si el archivo de Drive se llama distinto internamente, no importa: `gdown` lo descarga como `artifacts/sprint3_model.pt`.
- Si quieres usar otro nombre local, cambia `CXR_MODEL_CHECKPOINT`.
- Para produccion real, reemplaza `CXR_CORS_ORIGINS=*` por la URL publica del frontend.

### Frontend

Configura estas variables en el servicio frontend:

```text
BACKEND_URL=https://TU-BACKEND.up.railway.app
PORT=8501
```

## 4. Crear Servicios En Railway

### Backend

1. En Railway: **New Project** -> **Deploy from GitHub repo**.
2. Selecciona el repo `cxr-system`.
3. En el servicio backend:
   - **Root Directory:** `backend`
   - **Start Command:** dejar vacio si Railway usa el Dockerfile, o usar `./startup.sh`.
4. Agrega las variables de entorno del backend.
5. Ejecuta deploy.
6. Copia la URL publica del backend.

### Frontend

1. En el mismo proyecto: **New Service** -> **GitHub Repo** -> `cxr-system`.
2. En el servicio frontend:
   - **Root Directory:** `frontend`
   - **Start Command:** dejar vacio si Railway usa el Dockerfile, o usar:

   ```bash
   streamlit run app.py --server.port $PORT --server.address 0.0.0.0 --server.headless true
   ```

3. Agrega `BACKEND_URL` usando la URL publica del backend.
4. Ejecuta deploy.

## 5. Verificacion

Backend:

```bash
curl https://TU-BACKEND.up.railway.app/health
```

Debes ver un JSON con `status`, `model_loaded`, `checkpoint` y `startup_error`.

Swagger:

```text
https://TU-BACKEND.up.railway.app/docs
```

Frontend:

```text
https://TU-FRONTEND.up.railway.app
```

## 6. Problemas Frecuentes

### El Modelo No Descarga

- Revisa que `DRIVE_FILE_ID` sea solo el ID, no la URL completa.
- Revisa que el archivo en Drive este publico como **Cualquier persona con el enlace**.
- Mira los logs del backend: `startup.sh` imprime si falta el checkpoint o si falla la descarga.

### El Frontend No Conecta Con El Backend

- Verifica `BACKEND_URL` en Railway.
- Abre `https://TU-BACKEND.up.railway.app/health`.
- Si endureces CORS, agrega la URL exacta del frontend en `CXR_CORS_ORIGINS`.

### Railway Usa Otro Puerto

Los Dockerfile ya leen `$PORT`. Si defines Start Command manual, asegurate de usar `$PORT` tambien.

### El Deploy Tarda Mucho

El backend instala PyTorch y precarga TorchXRayVision, asi que el primer build puede tardar varios minutos.
