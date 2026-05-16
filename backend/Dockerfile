FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Requirements are now in the root of the build context (backend/)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything from backend/ (including frontend/)
COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
