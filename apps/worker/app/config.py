from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    database_url: str = "postgresql://agentforge:agentforge@localhost:5432/agentforge"
    redis_url: str = "redis://localhost:6379"
    encryption_key: str = ""
    s3_bucket: str = "agentforge-datasets"
    aws_access_key_id: str = "minioadmin"
    aws_secret_access_key: str = "minioadmin"  # noqa: S105
    aws_endpoint_url: str | None = None
    use_minio: bool = False
    consistency_runs: int = 3
    consistency_sample_size: int = 5
    suggest_model: str = "gpt-3.5-turbo"

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url


settings = Settings()
