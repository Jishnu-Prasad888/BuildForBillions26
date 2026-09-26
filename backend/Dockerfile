FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    WEB_CONCURRENCY=1 FORWARDED_ALLOW_IPS=127.0.0.1
WORKDIR /app
# fonts-noto-core: Noto Sans + Devanagari + Kannada, so Hindi/Kannada values can be written on generated PDFs.
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-hin tesseract-ocr-kan fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home --uid 1000 app && mkdir -p /data/uploads /data/users && chown -R app:app /data
COPY --chown=app:app app ./app
USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
# FORWARDED_ALLOW_IPS: which proxies may set X-Forwarded-For (the real client IP used for
# per-IP rate limits). Only widen it when the backend is reachable solely through the proxy.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY} --proxy-headers --timeout-graceful-shutdown 20"]
