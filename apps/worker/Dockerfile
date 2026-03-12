# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy only pyproject first for layer caching
COPY apps/worker/pyproject.toml ./pyproject.toml

# Install dependencies into /app/.venv
RUN uv venv .venv && \
    uv pip compile pyproject.toml -o requirements.txt && \
    uv pip install --no-cache -r requirements.txt

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM python:3.11-slim AS runner

WORKDIR /app

# Copy venv from builder
COPY --from=builder /app/.venv ./.venv

# Copy application code
COPY apps/worker ./

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN addgroup --system --gid 1001 worker && \
    adduser --system --uid 1001 --ingroup worker workeruser && \
    chown -R workeruser:worker /app
USER workeruser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
