"""Unit tests for app/executor.py — mocks litellm.acompletion."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.executor import (
    RowResult,
    _extract_avg_log_prob,
    _fill_template,
    _jaccard_similarity,
    execute_consistency_check,
    execute_row,
)


# ---------------------------------------------------------------------------
# _fill_template
# ---------------------------------------------------------------------------


class TestFillTemplate:
    def test_substitutes_from_variable_mapping(self) -> None:
        result = _fill_template(
            "Hello {{name}}!",
            {"full_name": "Alice"},
            {"name": "full_name"},
        )
        assert result == "Hello Alice!"

    def test_falls_back_to_direct_column_name(self) -> None:
        result = _fill_template(
            "Hello {{name}}!",
            {"name": "Bob"},
            {},
        )
        assert result == "Hello Bob!"

    def test_leaves_unknown_variable_unchanged(self) -> None:
        result = _fill_template("Hello {{unknown}}!", {"name": "Bob"}, {})
        assert result == "Hello {{unknown}}!"

    def test_multiple_variables(self) -> None:
        result = _fill_template(
            "{{greeting}} {{name}}, you are {{age}}",
            {"greeting": "Hi", "name": "Carol", "age": "30"},
            {},
        )
        assert result == "Hi Carol, you are 30"

    def test_variable_mapping_takes_priority_over_direct_key(self) -> None:
        # Row has both "name" and "alias"; mapping maps "name" → "alias"
        result = _fill_template(
            "Hello {{name}}",
            {"name": "direct", "alias": "via_mapping"},
            {"name": "alias"},
        )
        assert result == "Hello via_mapping"

    def test_strips_whitespace_in_placeholder(self) -> None:
        result = _fill_template("{{ name }}", {"name": "Alice"}, {})
        assert result == "Alice"


# ---------------------------------------------------------------------------
# _extract_avg_log_prob
# ---------------------------------------------------------------------------


class TestExtractAvgLogProb:
    def test_returns_none_when_no_logprobs(self) -> None:
        choice = MagicMock()
        choice.logprobs = None
        assert _extract_avg_log_prob(choice) is None

    def test_openai_format_with_content_list(self) -> None:
        token1 = MagicMock(logprob=-0.2)
        token2 = MagicMock(logprob=-0.4)
        logprobs = MagicMock()
        logprobs.content = [token1, token2]
        logprobs.token_logprobs = None
        choice = MagicMock()
        choice.logprobs = logprobs

        result = _extract_avg_log_prob(choice)
        assert result == pytest.approx((-0.2 + -0.4) / 2)

    def test_older_format_token_logprobs(self) -> None:
        logprobs = MagicMock()
        logprobs.content = None
        logprobs.token_logprobs = [-0.1, -0.3, None]
        choice = MagicMock()
        choice.logprobs = logprobs

        result = _extract_avg_log_prob(choice)
        assert result == pytest.approx((-0.1 + -0.3) / 2)

    def test_returns_none_when_content_empty(self) -> None:
        logprobs = MagicMock()
        logprobs.content = []
        logprobs.token_logprobs = None
        choice = MagicMock()
        choice.logprobs = logprobs
        assert _extract_avg_log_prob(choice) is None


# ---------------------------------------------------------------------------
# _jaccard_similarity
# ---------------------------------------------------------------------------


class TestJaccardSimilarity:
    def test_identical_strings(self) -> None:
        assert _jaccard_similarity("hello world", "hello world") == pytest.approx(1.0)

    def test_completely_different(self) -> None:
        assert _jaccard_similarity("foo bar", "baz qux") == pytest.approx(0.0)

    def test_partial_overlap(self) -> None:
        # tokens_a = {hello, world}, tokens_b = {hello, there}
        # intersection = {hello}, union = {hello, world, there}
        assert _jaccard_similarity("hello world", "hello there") == pytest.approx(1 / 3)

    def test_both_empty(self) -> None:
        assert _jaccard_similarity("", "") == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# execute_row
# ---------------------------------------------------------------------------


def _make_litellm_response(content: str, input_tokens: int = 10, output_tokens: int = 20) -> MagicMock:
    mock_response = MagicMock()
    choice = MagicMock()
    choice.message.content = content
    choice.logprobs = None
    mock_response.choices = [choice]
    mock_response.usage.prompt_tokens = input_tokens
    mock_response.usage.completion_tokens = output_tokens
    return mock_response


class TestExecuteRow:
    async def test_returns_row_result_on_success(self) -> None:
        mock_response = _make_litellm_response("Paris", 5, 3)
        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=mock_response):
            result = await execute_row(
                prompt_template="What is the capital of {{country}}?",
                row={"country": "France"},
                variable_mapping={},
                model_name="gpt-4o-mini",
                model_config={},
                api_key="sk-test",
                provider_type="openai",
                base_url=None,
                row_index=0,
            )

        assert isinstance(result, RowResult)
        assert result.prediction == "Paris"
        assert result.input_tokens == 5
        assert result.output_tokens == 3
        assert result.error is None
        assert result.row_index == 0

    async def test_returns_error_result_on_exception(self) -> None:
        with patch("litellm.acompletion", new_callable=AsyncMock, side_effect=RuntimeError("API error")):
            result = await execute_row(
                prompt_template="{{q}}",
                row={"q": "hello"},
                variable_mapping={},
                model_name="gpt-4o-mini",
                model_config={},
                api_key="sk-test",
                provider_type="openai",
                base_url=None,
            )

        assert result.prediction == ""
        assert result.error == "API error"
        assert result.input_tokens == 0
        assert result.output_tokens == 0

    async def test_passes_model_config_params(self) -> None:
        mock_response = _make_litellm_response("answer")
        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=mock_response) as mock_call:
            await execute_row(
                prompt_template="Q: {{q}}",
                row={"q": "test"},
                variable_mapping={},
                model_name="gpt-4o",
                model_config={"temperature": 0.5, "topP": 0.9, "maxTokens": 100},
                api_key="sk-test",
                provider_type="openai",
                base_url=None,
            )

        call_kwargs = mock_call.call_args[1]
        assert call_kwargs["temperature"] == 0.5
        assert call_kwargs["top_p"] == 0.9
        assert call_kwargs["max_tokens"] == 100

    async def test_passes_base_url_when_provided(self) -> None:
        mock_response = _make_litellm_response("ok")
        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=mock_response) as mock_call:
            await execute_row(
                prompt_template="hello",
                row={},
                variable_mapping={},
                model_name="ollama/llama3",
                model_config={},
                api_key="none",
                provider_type="ollama",
                base_url="http://localhost:11434",
            )

        call_kwargs = mock_call.call_args[1]
        assert call_kwargs["api_base"] == "http://localhost:11434"

    async def test_empty_content_returned_as_empty_string(self) -> None:
        mock_response = _make_litellm_response("")
        mock_response.choices[0].message.content = None
        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=mock_response):
            result = await execute_row(
                prompt_template="hello",
                row={},
                variable_mapping={},
                model_name="gpt-4o-mini",
                model_config={},
                api_key="sk-test",
                provider_type="openai",
                base_url=None,
            )

        assert result.prediction == ""


# ---------------------------------------------------------------------------
# execute_consistency_check
# ---------------------------------------------------------------------------


class TestExecuteConsistencyCheck:
    async def test_returns_per_row_similarity(self) -> None:
        # With deterministic outputs similarity = 1.0
        call_count = 0

        async def fake_execute_row(**kwargs: object) -> RowResult:
            nonlocal call_count
            call_count += 1
            return RowResult(
                row_index=0,
                prediction="same output every time",
                input_tokens=5,
                output_tokens=5,
                latency_s=0.1,
                log_prob=None,
                error=None,
            )

        with patch("app.executor.execute_row", side_effect=fake_execute_row):
            similarities = await execute_consistency_check(
                prompt_template="Q: {{q}}",
                sample_rows=[{"q": "one"}, {"q": "two"}],
                variable_mapping={},
                model_name="gpt-4o-mini",
                model_config={},
                api_key="sk-test",
                provider_type="openai",
                base_url=None,
                n_runs=3,
            )

        assert len(similarities) == 2
        for sim in similarities:
            assert sim == pytest.approx(1.0)

    async def test_returns_low_similarity_for_varied_outputs(self) -> None:
        outputs = iter(["alpha beta gamma", "delta epsilon zeta", "eta theta iota"])

        async def fake_execute_row(**kwargs: object) -> RowResult:
            return RowResult(
                row_index=0,
                prediction=next(outputs),
                input_tokens=5,
                output_tokens=5,
                latency_s=0.1,
                log_prob=None,
                error=None,
            )

        with patch("app.executor.execute_row", side_effect=fake_execute_row):
            similarities = await execute_consistency_check(
                prompt_template="{{q}}",
                sample_rows=[{"q": "test"}],
                variable_mapping={},
                model_name="gpt-4o-mini",
                model_config={},
                api_key="sk-test",
                provider_type="openai",
                base_url=None,
                n_runs=3,
            )

        assert len(similarities) == 1
        assert similarities[0] < 0.5
