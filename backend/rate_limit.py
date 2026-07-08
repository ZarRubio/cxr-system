try:
    from slowapi import Limiter

    def _client_key(request) -> str:
        """
        IP real del cliente. Detras del proxy Next.js la conexion siempre viene
        de la misma IP, asi que se prioriza X-Forwarded-For (el proxy es el unico
        que puede alcanzar los endpoints protegidos por API key).
        """
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    limiter = Limiter(key_func=_client_key)
    RATE_LIMITING_AVAILABLE = True
except ModuleNotFoundError:
    RATE_LIMITING_AVAILABLE = False

    class _NoOpLimiter:
        def limit(self, *_args, **_kwargs):
            def decorator(func):
                return func

            return decorator

    limiter = _NoOpLimiter()
