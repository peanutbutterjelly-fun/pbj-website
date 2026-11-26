"""Settings read from environment variables (or a local .env file)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "PB&J API"
    environment: str = "development"
    # Website addresses allowed to call the API from a browser
    cors_origins: list[str] = ["http://localhost:5173"]

    # Supabase project, e.g. https://xxxx.supabase.co (used to check login tokens)
    supabase_url: str = ""
    # Postgres connection string. Locally the direct one; on Railway the IPv4 pooler one.
    database_url: str = ""
    # Supabase secret key: admin access (e.g. managing users). Not used yet; never send it to the website.
    supabase_secret_key: str = ""

    # The back office (staff-only admin screen) login. Only a scrambled fingerprint of the password lives here, never the
    # password itself. To change it, set ADMIN_PASSWORD_HASH on Railway (make one with: python -m app.admin_auth).
    admin_username: str = "pbj-admin"
    admin_password_hash: str = "scrypt$16384$8$1$scmn1pv5PZnHWoonlMjaOA==$O8cXANz0jhxJ4yahVRwqjVYsv3wFpObayJ9RRUEHN90="

    @property
    def supabase_issuer(self) -> str:
        return self.supabase_url.rstrip("/") + "/auth/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
