"""Sealos Scheduler 主入口。

- FastAPI 暴露 /healthz 健康检查（Sealos liveness/readiness 依赖）
- APScheduler 在启动时挂载所有 cron job（Phase 4–8 内逐步注册）
- 时区固定 Asia/Shanghai
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from sealos.scheduler.config import get_settings

scheduler: AsyncIOScheduler | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone=settings.tz)
    # cron job 在 Phase 4+ 通过 register_jobs(scheduler) 添加
    scheduler.start()
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)


app = FastAPI(title="stock-analyzer-scheduler", lifespan=lifespan)


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "status": "ok",
        "scheduler_running": scheduler is not None and scheduler.running,
    }
