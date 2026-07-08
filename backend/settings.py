from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuracion central del backend. Todas las variables usan prefijo CXR_."""

    cors_origins: str = "http://localhost:3000"
    skip_model_load: bool = False
    rate_limit_predict: str = "20/minute"
    audit_log_path: str = "logs/audit.jsonl"

    # Autenticacion: si esta vacio, la validacion de API key queda desactivada
    # (desarrollo local y tests). En produccion el proxy Next.js envia X-API-Key.
    api_key: str = ""

    # Limites de carga y validacion de imagenes
    max_upload_mb: int = 15
    min_file_bytes: int = 1024
    min_image_dim: int = 64
    max_image_dim: int = 8192

    # Cache de predicciones y lotes
    cache_max_entries: int = 20
    batch_max_files: int = 8

    model_config = SettingsConfigDict(
        env_prefix="CXR_",
        extra="ignore",
        protected_namespaces=(),
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_file_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


settings = Settings()
