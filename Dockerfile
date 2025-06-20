FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY saync_main.py .
COPY thread_downloader.py .
COPY celery_tasks.py .
COPY api.py .

CMD ["uvicorn", "saync_main:app", "--host", "0.0.0.0", "--port", "8000"] 