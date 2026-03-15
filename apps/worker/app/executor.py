import re
import time
from dataclasses import dataclass

import litellm  # type: ignore[import-untyped]


@dataclass
class RowResult:
    row_index: int
    prediction: str
    input_tokens: int
    output_tokens: int
    latency_s: float
    log_prob: float | None
    error: str | None


def _fill_template(
    prompt_template: str,
    row: dict[str, object],
    variable_mapping: dict[str, str],
) -> str:
    """Substitute {{varName}} placeholders using variable_mapping or direct column names."""
    result = prompt_template

    def replacer(match: re.Match[str]) -> str:
        var_name = match.group(1).strip()
        # Try variable_mapping first
        if variable_mapping and var_name in variable_mapping:
            col_name = variable_mapping[var_name]
            return str(row.get(col_name, match.group(0)))
        # Fall back to direct column name
        if var_name in row:
            return str(row[var_name])
        # Leave unchanged
        return match.group(0)

    return re.sub(r"\{\{(\s*\w+\s*)\}\}", replacer, result)


def _extract_avg_log_prob(choice: object) -> float | None:
    """Extract average log-prob per token from a LiteLLM choice, if available."""
    logprobs = getattr(choice, "logprobs", None)
    if logprobs is None:
        return None
    # OpenAI format: logprobs.content is list of token log-prob objects
    content = getattr(logprobs, "content", None)
    if content and isinstance(content, list) and len(content) > 0:
        token_logprobs = [t.logprob for t in content if hasattr(t, "logprob")]
        if token_logprobs:
            return sum(token_logprobs) / len(token_logprobs)
    # Older format: logprobs.token_logprobs
    token_logprobs_list = getattr(logprobs, "token_logprobs", None)
    if token_logprobs_list and isinstance(token_logprobs_list, list):
        valid = [lp for lp in token_logprobs_list if lp is not None]
        if valid:
            return sum(valid) / len(valid)
    return None


async def execute_row(
    prompt_template: str,
    row: dict[str, object],
    variable_mapping: dict[str, str],
    model_name: str,
    model_config: dict[str, object],
    api_key: str,
    provider_type: str,
    base_url: str | None,
    row_index: int = 0,
) -> RowResult:
    """Substitute variables into template and call LiteLLM."""
    filled_prompt = _fill_template(prompt_template, row, variable_mapping)

    kwargs: dict[str, object] = {
        "model": model_name,
        "messages": [{"role": "user", "content": filled_prompt}],
        "api_key": api_key,
    }
    if base_url:
        kwargs["api_base"] = base_url
    if model_config.get("temperature") is not None:
        kwargs["temperature"] = model_config["temperature"]
    if model_config.get("topP") is not None:
        kwargs["top_p"] = model_config["topP"]
    if model_config.get("maxTokens") is not None:
        kwargs["max_tokens"] = model_config["maxTokens"]

    start = time.perf_counter()
    try:
        response = await litellm.acompletion(**kwargs)
        latency_s = time.perf_counter() - start

        choice = response.choices[0]
        prediction = choice.message.content or ""
        usage = response.usage
        input_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        output_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        log_prob = _extract_avg_log_prob(choice)

        return RowResult(
            row_index=row_index,
            prediction=prediction,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_s=latency_s,
            log_prob=log_prob,
            error=None,
        )
    except Exception as exc:
        latency_s = time.perf_counter() - start
        return RowResult(
            row_index=row_index,
            prediction="",
            input_tokens=0,
            output_tokens=0,
            latency_s=latency_s,
            log_prob=None,
            error=str(exc),
        )


def _jaccard_similarity(text_a: str, text_b: str) -> float:
    """Compute Jaccard similarity between token sets of two strings."""
    tokens_a = set(text_a.lower().split())
    tokens_b = set(text_b.lower().split())
    if not tokens_a and not tokens_b:
        return 1.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union) if union else 0.0


async def execute_consistency_check(
    prompt_template: str,
    sample_rows: list[dict[str, object]],
    variable_mapping: dict[str, str],
    model_name: str,
    model_config: dict[str, object],
    api_key: str,
    provider_type: str,
    base_url: str | None,
    n_runs: int = 3,
) -> list[float]:
    """Run each sample row n_runs times, compute Jaccard similarity between runs.

    Returns a list of per-row mean pairwise Jaccard similarities.
    """
    similarities: list[float] = []

    for row in sample_rows:
        run_outputs: list[str] = []
        for _ in range(n_runs):
            result = await execute_row(
                prompt_template=prompt_template,
                row=row,
                variable_mapping=variable_mapping,
                model_name=model_name,
                model_config=model_config,
                api_key=api_key,
                provider_type=provider_type,
                base_url=base_url,
            )
            run_outputs.append(result.prediction)

        # Compute pairwise Jaccard similarities between all run pairs
        pair_sims: list[float] = []
        for i in range(len(run_outputs)):
            for j in range(i + 1, len(run_outputs)):
                pair_sims.append(_jaccard_similarity(run_outputs[i], run_outputs[j]))
        if pair_sims:
            similarities.append(sum(pair_sims) / len(pair_sims))

    return similarities
