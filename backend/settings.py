import os

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ModuleNotFoundError:
    BaseSettings = None
    SettingsConfigDict = None


if BaseSettings is not None:
    class Settings(BaseSettings):
        model_checkpoint: str = "sprint3_model.pt"
        cors_origins: str = "*"
        skip_model_load: bool = False
        rate_limit_predict: str = "20/minute"
        audit_log_path: str = "logs/audit.jsonl"

        model_config = SettingsConfigDict(
            env_prefix="CXR_",
            extra="ignore",
            protected_namespaces=(),
        )

        @property
        def cors_origin_list(self) -> list[str]:
            return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
else:
    class Settings:
        def __init__(self) -> None:
            self.model_checkpoint = os.getenv("CXR_MODEL_CHECKPOINT", "sprint3_model.pt")
            self.cors_origins = os.getenv("CXR_CORS_ORIGINS", "*")
            self.skip_model_load = os.getenv("CXR_SKIP_MODEL_LOAD", "").lower() in {"1", "true", "yes"}
            self.rate_limit_predict = os.getenv("CXR_RATE_LIMIT_PREDICT", "20/minute")
            self.audit_log_path = os.getenv("CXR_AUDIT_LOG_PATH", "logs/audit.jsonl")

        @property
        def cors_origin_list(self) -> list[str]:
            return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
