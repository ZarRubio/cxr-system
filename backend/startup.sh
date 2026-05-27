#!/usr/bin/env bash
set -euo pipefail

MODEL_NAME="${CXR_MODEL_CHECKPOINT:-sprint3_model.pt}"
MODEL_PATH="artifacts/${MODEL_NAME}"
PORT="${PORT:-8000}"

mkdir -p artifacts logs

if [ ! -f "$MODEL_PATH" ]; then
    if [ -z "${DRIVE_FILE_ID:-}" ]; then
        echo "ERROR: model checkpoint not found at ${MODEL_PATH} and DRIVE_FILE_ID is not set."
        echo "Set DRIVE_FILE_ID in Railway, or mount/copy ${MODEL_NAME} into backend/artifacts."
        exit 1
    fi

    echo "Downloading model checkpoint from Google Drive..."
    gdown "https://drive.google.com/uc?id=${DRIVE_FILE_ID}" -O "$MODEL_PATH"
    echo "Model downloaded: $(du -h "$MODEL_PATH" | cut -f1) at ${MODEL_PATH}"
else
    echo "Model already present: $(du -h "$MODEL_PATH" | cut -f1) at ${MODEL_PATH}"
fi

echo "Starting FastAPI on 0.0.0.0:${PORT}"
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
