# Sealos 上运行 stock-analyzer Scheduler 服务
# 包含：AKShare 行情拉取、DeepSeek AI 产物生成、CLS 资讯、市场日历刷新、清理任务、Realtime 广播
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Asia/Shanghai

# 时区与系统依赖（pandas / numpy 对 libgomp 的依赖；akshare 依赖 lxml/curl）
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       tzdata libgomp1 curl ca-certificates \
    && ln -sf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY . .

EXPOSE 8000

# 健康检查路径需在 main.py 暴露 GET /healthz
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/healthz || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
