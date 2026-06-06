#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8000}"
mkdir -p artifacts logs

# Verificar que los checkpoints del ensemble esten presentes
V1="artifacts/sprint4ml_v1.pt"
V2="artifacts/sprint4ml_v2.pt"

if [ ! -f "$V1" ] || [ ! -f "$V2" ]; then
    echo "ERROR: Faltan checkpoints del ensemble."
    echo "  Esperados: $V1, $V2"
    echo "  Verifica que esten incluidos en la imagen Docker."
    exit 1
fi

echo "Ensemble checkpoints OK:"
echo "  v1: $(du -h "$V1" | cut -f1) — $V1"
echo "  v2: $(du -h "$V2" | cut -f1) — $V2"

echo "Starting FastAPI on 0.0.0.0:${PORT}"
exec uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers 1
