import os

try:
    from pydantic import AnyHttpUrl
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ModuleNotFoundError:
    BaseSettings = None
    AnyHttpUrl = None
    SettingsConfigDict = None


if BaseSettings is not None:
    class Settings(BaseSettings):
        backend_url: AnyHttpUrl = "http://localhost:8000"

        model_config = SettingsConfigDict(
            env_prefix="",
            extra="ignore",
        )
else:
    class Settings:
        def __init__(self) -> None:
            self.backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")


settings = Settings()
