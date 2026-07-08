"""Validacion de API key compartida entre el proxy Next.js y el backend."""
import hmac

from fastapi import HTTPException, Request

from settings import settings


async def require_api_key(request: Request) -> None:
    """
    Dependencia FastAPI: exige el header X-API-Key cuando CXR_API_KEY esta
    configurada. Con la key vacia (desarrollo local, tests) no valida nada.
    """
    if not settings.api_key:
        return
    provided = request.headers.get("X-API-Key", "")
    if not hmac.compare_digest(provided, settings.api_key):
        raise HTTPException(status_code=401, detail="API key invalida o ausente.")
