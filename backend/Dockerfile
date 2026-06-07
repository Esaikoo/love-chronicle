FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DEFAULT_TIMEOUT=180
ENV PIP_RETRIES=5

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir "openpyxl==3.1.5"
RUN pip install --no-cache-dir --force-reinstall "uvicorn[standard]==0.30.6"

COPY app ./app
RUN mkdir -p uploads/photos uploads/music uploads/covers uploads/calendar uploads/checkins uploads/travel

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
