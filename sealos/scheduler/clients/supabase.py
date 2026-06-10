"""supabase-py service_role 客户端封装。

所有写库操作走此处，绕过 RLS；不要用 anon key。
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from sealos.scheduler.config import get_settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
