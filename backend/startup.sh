#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8000}"
mkdir -p artifacts logs

# Verificar que los checkpoints del ensemble esten presentes
V1="artifacts/sprint4ml_v1.pt"
V2="artifacts/sprint4ml_v2.pt"

SKIP="${CXR_SKIP_MODEL_LOAD:-false}"
if [ "$SKIP" = "1" ] || [ "$SKIP" = "true" ]; then
    # Solo para revisar contenedores, puertos e integracion sin los pesos (no se publican en el repositorio).
    echo "AVISO: CXR_SKIP_MODEL_LOAD activo; el servicio arranca sin modelo (/health = degraded, sin inferencia)."
elif [ ! -f "$V1" ] || [ ! -f "$V2" ]; then
    echo "ERROR: Faltan checkpoints del ensemble."
    echo "  Esperados: $V1, $V2"
    echo "  Copielos en backend/artifacts (los entrega el responsable del proyecto) o, solo para"
    echo "  revisar la integracion sin inferencia, use CXR_SKIP_MODEL_LOAD=1."
    exit 1
else
    echo "Ensemble checkpoints OK:"
    echo "  v1: $(du -h "$V1" | cut -f1) — $V1"
    echo "  v2: $(du -h "$V2" | cut -f1) — $V2"
fi

echo "Starting FastAPI on 0.0.0.0:${PORT}"
exec uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers 1
