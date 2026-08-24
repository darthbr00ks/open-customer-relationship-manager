from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Set DATABASE_URL in your .env file, e.g. ******localhost:5432/open_rm
    database_url: str
    debug: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
