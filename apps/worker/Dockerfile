# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Tell uv where the venv lives so uv pip commands target it automatically.
# /venv is outside /app so docker-compose source volume mounts don't shadow it.
ENV VIRTUAL_ENV=/venv
ENV PATH="/venv/bin:$PATH"

# Copy only pyproject first for layer caching
COPY apps/worker/pyproject.toml ./pyproject.toml

RUN uv venv /venv && \
    uv pip compile pyproject.toml -o requirements.txt && \
    uv pip install --no-cache -r requirements.txt

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM python:3.11-slim AS runner

# Create user first so COPY --chown can reference it immediately.
# Avoids a separate chown -R pass over the large .venv tree.
RUN groupadd --gid 1001 worker && \
    useradd --uid 1001 --gid worker --no-create-home workeruser

WORKDIR /app

# Copy with correct ownership upfront — no chown -R needed
COPY --from=builder --chown=workeruser:worker /venv /venv
COPY --chown=workeruser:worker apps/worker ./

ENV PATH="/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

USER workeruser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
