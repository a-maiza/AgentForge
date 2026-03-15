"""Light integration tests for the FastAPI worker application."""

import json
from collections.abc import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_litellm_response(content: str) -> MagicMock:
    """Build a mock LiteLLM response object."""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = content
    mock_response.usage.prompt_tokens = 20
    mock_response.usage.completion_tokens = 30
    return mock_response


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def app_no_consumer() -> Generator[FastAPI, None, None]:
    """Return a FastAPI app instance with the lifespan consumer loop disabled."""
    from main import app as _app

    # Patch run_consumer_loop to a no-op so no Redis connection is attempted
    with patch("main.run_consumer_loop", new_callable=AsyncMock):
        yield _app


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health_endpoint(app_no_consumer: FastAPI) -> None:
    """GET /health should return {status: ok}."""
    async with AsyncClient(
        transport=ASGITransport(app=app_no_consumer), base_url="http://test"
    ) as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# POST /suggest
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_suggest_metrics_success(app_no_consumer: FastAPI) -> None:
    """POST /suggest should return metric suggestions from a mocked LiteLLM response."""
    mock_content = json.dumps(
        {
            "suggestions": [
                {"metric": "f1", "match_pct": 0.95, "reason": "Great for QA tasks"},
                {"metric": "exact_match", "match_pct": 0.85, "reason": "Strict accuracy"},
                {"metric": "rouge", "match_pct": 0.80, "reason": "Text overlap"},
            ]
        }
    )
    mock_response = _make_mock_litellm_response(mock_content)

    with patch("main.litellm.acompletion", new_callable=AsyncMock) as mock_complete:
        mock_complete.return_value = mock_response
        async with AsyncClient(
            transport=ASGITransport(app=app_no_consumer), base_url="http://test"
        ) as client:
            response = await client.post(
                "/suggest",
                json={"prompt_content": "Answer the question: {{question}}", "top_n": 3},
            )

    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert len(data["suggestions"]) == 3
    assert data["suggestions"][0]["metric"] == "f1"
    assert data["suggestions"][0]["match_pct"] == pytest.approx(0.95)
    assert "reason" in data["suggestions"][0]


@pytest.mark.asyncio
async def test_suggest_metrics_top_n_limit(app_no_consumer: FastAPI) -> None:
    """POST /suggest respects top_n and does not return more suggestions than requested."""
    mock_content = json.dumps(
        {
            "suggestions": [
                {"metric": "f1", "match_pct": 0.95, "reason": "reason 1"},
                {"metric": "bleu", "match_pct": 0.85, "reason": "reason 2"},
                {"metric": "rouge", "match_pct": 0.80, "reason": "reason 3"},
                {"metric": "accuracy", "match_pct": 0.75, "reason": "reason 4"},
            ]
        }
    )
    mock_response = _make_mock_litellm_response(mock_content)

    with patch("main.litellm.acompletion", new_callable=AsyncMock) as mock_complete:
        mock_complete.return_value = mock_response
        async with AsyncClient(
            transport=ASGITransport(app=app_no_consumer), base_url="http://test"
        ) as client:
            response = await client.post(
                "/suggest",
                json={"prompt_content": "Translate: {{text}}", "top_n": 2},
            )

    assert response.status_code == 200
    data = response.json()
    assert len(data["suggestions"]) == 2


@pytest.mark.asyncio
async def test_suggest_metrics_invalid_json_returns_502(app_no_consumer: FastAPI) -> None:
    """POST /suggest returns 502 when the LLM produces invalid JSON."""
    mock_response = _make_mock_litellm_response("not valid json at all {{{")

    with patch("main.litellm.acompletion", new_callable=AsyncMock) as mock_complete:
        mock_complete.return_value = mock_response
        async with AsyncClient(
            transport=ASGITransport(app=app_no_consumer), base_url="http://test"
        ) as client:
            response = await client.post(
                "/suggest",
                json={"prompt_content": "Summarise: {{document}}"},
            )

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_suggest_metrics_litellm_error_returns_502(app_no_consumer: FastAPI) -> None:
    """POST /suggest returns 502 when LiteLLM raises an exception."""
    with patch("main.litellm.acompletion", new_callable=AsyncMock) as mock_complete:
        mock_complete.side_effect = RuntimeError("LiteLLM connection refused")
        async with AsyncClient(
            transport=ASGITransport(app=app_no_consumer), base_url="http://test"
        ) as client:
            response = await client.post(
                "/suggest",
                json={"prompt_content": "Classify: {{text}}"},
            )

    assert response.status_code == 502
