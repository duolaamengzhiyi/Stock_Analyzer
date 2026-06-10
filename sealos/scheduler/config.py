"""集中式配置：从环境变量读取所有 URL/Key（FR-051 / FR-106）。

通过 pydantic-settings 提供：类型安全 + 缺省值 + .env 加载。
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Supabase
    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")

    # DeepSeek
    deepseek_api_key: str = Field(..., alias="DEEPSEEK_API_KEY")
    deepseek_base_url: str = Field(
        "https://api.deepseek.com/v1", alias="DEEPSEEK_BASE_URL"
    )
    deepseek_model_midday: str = Field(
        "deepseek-v4-pro", alias="DEEPSEEK_MODEL_MIDDAY"
    )
    deepseek_model_evening: str = Field(
        "deepseek-v4-pro", alias="DEEPSEEK_MODEL_EVENING"
    )
    deepseek_model_forecast: str = Field(
        "deepseek-v4-pro", alias="DEEPSEEK_MODEL_FORECAST"
    )
    deepseek_model_news_summary: str = Field(
        "deepseek-v4-flash", alias="DEEPSEEK_MODEL_NEWS_SUMMARY"
    )

    # AKTools (Sealos 自部署的 akfamily/aktools)
    aktools_base_url: str = Field(..., alias="AKTOOLS_BASE_URL")

    # 时区固定 Asia/Shanghai
    tz: str = Field("Asia/Shanghai", alias="TZ")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
