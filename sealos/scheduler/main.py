"""Sealos Scheduler 主入口。

- FastAPI 暴露 /healthz 健康检查（Sealos liveness/readiness 依赖）
- APScheduler 在启动时挂载所有 cron job（Phase 4 已注册：行情 / 清理 / 日历）
- HTTP 管理端点 POST /trigger/<job_id>（X-Scheduler-Token 鉴权），
  覆盖 contracts/sealos-jobs.md 列出的 job_id 子集（Phase 4 子集，余下 phase 后补）
- 时区固定 Asia/Shanghai
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, Awaitable, Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, Header, HTTPException

from sealos.scheduler.config import get_settings
from sealos.scheduler.jobs import calendar_refresh, cleanup, initial_backfill, stock_daily

logger = logging.getLogger(__name__)
scheduler: AsyncIOScheduler | None = None


# job_id（contracts/sealos-jobs.md 命名）→ 异步入口
JOB_REGISTRY: dict[str, Callable[[], Awaitable[dict[str, Any]]]] = {
    "initial-backfill": initial_backfill.run,
    "stock-daily-midday": stock_daily.run_midday,
    "stock-daily-close": stock_daily.run_close,
    "cleanup": cleanup.run,
    "calendar-refresh": calendar_refresh.run,
}


def _register_cron_jobs(s: AsyncIOScheduler) -> None:
    """按 contracts/sealos-jobs.md 注册 Phase 4 范围内的 cron。

    时区由 AsyncIOScheduler 实例化时统一指定为 Asia/Shanghai。
    """
    s.add_job(
        stock_daily.run_midday,
        CronTrigger(hour=11, minute=30, day_of_week="mon-fri"),
        id="stock-daily-midday",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    s.add_job(
        stock_daily.run_close,
        CronTrigger(hour=15, minute=15, day_of_week="mon-fri"),
        id="stock-daily-close",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    s.add_job(
        cleanup.run,
        CronTrigger(hour=4, minute=0),
        id="cleanup",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    s.add_job(
        calendar_refresh.run,
        CronTrigger(hour=3, minute=0, day_of_week="sun"),
        id="calendar-refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone=settings.tz)
    _register_cron_jobs(scheduler)
    scheduler.start()
    logger.info("APScheduler started; jobs=%s", [j.id for j in scheduler.get_jobs()])
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


@app.get("/jobs")
def list_jobs(x_scheduler_token: str | None = Header(default=None)) -> dict[str, Any]:
    _require_auth(x_scheduler_token)
    if scheduler is None:
        return {"jobs": []}
    return {
        "jobs": [
            {
                "id": j.id,
                "next_run_time": j.next_run_time.isoformat() if j.next_run_time else None,
            }
            for j in scheduler.get_jobs()
        ]
    }


@app.post("/trigger/{job_id}")
async def trigger_job(
    job_id: str,
    x_scheduler_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_auth(x_scheduler_token)
    runner = JOB_REGISTRY.get(job_id)
    if runner is None:
        raise HTTPException(
            status_code=404,
            detail=f"未知 job_id: {job_id}（已注册：{sorted(JOB_REGISTRY.keys())}）",
        )
    result = await runner()
    return {"job_id": job_id, "result": result}


def _require_auth(token: str | None) -> None:
    expected = get_settings().scheduler_auth_token
    if not token or token != expected:
        raise HTTPException(status_code=401, detail="invalid scheduler token")
