try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMITING_AVAILABLE = True
except ModuleNotFoundError:
    RATE_LIMITING_AVAILABLE = False

    class _NoOpLimiter:
        def limit(self, *_args, **_kwargs):
            def decorator(func):
                return func

            return decorator

    limiter = _NoOpLimiter()
