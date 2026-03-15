"""AgentForge evaluation worker — FastAPI entry point."""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import litellm  # type: ignore[import-untyped]
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.worker import run_consumer_loop

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    """Start consumer loop as background task on startup; cancel on shutdown."""
    task = asyncio.create_task(run_consumer_loop())
    logger.info("Evaluation consumer loop started")
    try:
        yield
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        logger.info("Evaluation consumer loop stopped")


app = FastAPI(
    title="AgentForge Eval Worker",
    description="Async evaluation job processor",
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class SuggestRequest(BaseModel):
    """Request body for metric suggestion endpoint."""

    prompt_content: str
    top_n: int = 5


class MetricSuggestion(BaseModel):
    """A single metric suggestion with confidence and rationale."""

    metric: str
    match_pct: float
    reason: str


class SuggestResponse(BaseModel):
    """Response body for metric suggestion endpoint."""

    suggestions: list[MetricSuggestion]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

_AVAILABLE_METRICS = (
    "exact_match, f1, bleu, rouge, bertscore, accuracy, "
    "perplexity, consistency_score, latency, throughput"
)

_SUGGEST_SYSTEM_PROMPT = (
    "You are an LLM evaluation expert. Given a prompt template, "
    "suggest the most relevant evaluation metrics.\n\n"
    f"Available metrics: {_AVAILABLE_METRICS}\n\n"
    "Respond ONLY with valid JSON in this exact format "
    "(no markdown, no explanation):\n"
    '{\n  "suggestions": [\n'
    '    {"metric": "metric_name", "match_pct": 0.95, '
    '"reason": "brief reason why this metric fits"},\n'
    "    ...\n  ]\n}\n\n"
    "Return exactly the top N most relevant metrics. "
    "match_pct should be between 0.0 and 1.0."
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Return service health status."""
    return {"status": "ok"}


@app.post(
    "/suggest",
    responses={502: {"description": "LLM call failed or returned invalid JSON"}},
)
async def suggest_metrics(payload: SuggestRequest) -> SuggestResponse:
    """Call LiteLLM to suggest top metrics for a given prompt."""
    user_message = (
        f"Prompt template:\n\n{payload.prompt_content}\n\n"
        f"Suggest the top {payload.top_n} evaluation metrics."
    )
    try:
        response = await litellm.acompletion(
            model=settings.suggest_model,
            messages=[
                {"role": "system", "content": _SUGGEST_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
            max_tokens=1024,
        )
        content = response.choices[0].message.content or "{}"
        # Strip markdown code fences if present
        content = content.strip()
        if content.startswith("```"):
            lines = content.splitlines()
            content = "\n".join(line for line in lines if not line.startswith("```")).strip()

        data = json.loads(content)
        raw_suggestions = data.get("suggestions", [])
        suggestions = [
            MetricSuggestion(
                metric=s["metric"],
                match_pct=float(s["match_pct"]),
                reason=s["reason"],
            )
            for s in raw_suggestions[: payload.top_n]
        ]
        return SuggestResponse(suggestions=suggestions)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"LLM returned invalid JSON: {exc}") from exc
    except Exception as exc:
        logger.exception("Error calling LiteLLM for suggest: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
