import math
from collections import Counter
from dataclasses import dataclass, field

import numpy as np

from app.metrics.carbon import estimate_carbon, estimate_power
from app.metrics.cost import cost_per_1m_tokens
from app.metrics.grade import compute_grade


@dataclass
class MetricResult:
    name: str
    score: float
    grade: str
    details: dict[str, object] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Token-level helpers
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> list[str]:
    return text.lower().split()


def _token_f1_precision_recall(prediction: str, reference: str) -> tuple[float, float, float]:
    pred_tokens = _tokenize(prediction)
    ref_tokens = _tokenize(reference)
    pred_counter = Counter(pred_tokens)
    ref_counter = Counter(ref_tokens)
    common = sum((pred_counter & ref_counter).values())
    if common == 0:
        return 0.0, 0.0, 0.0
    precision = common / len(pred_tokens) if pred_tokens else 0.0
    recall = common / len(ref_tokens) if ref_tokens else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    return f1, precision, recall


# ---------------------------------------------------------------------------
# Individual metric functions
# ---------------------------------------------------------------------------


def compute_exact_match(predictions: list[str], references: list[str]) -> MetricResult:
    """Compute exact-match score using HuggingFace evaluate."""
    import evaluate  # type: ignore[import-untyped]

    em_metric = evaluate.load("exact_match")
    result = em_metric.compute(predictions=predictions, references=references)
    score = float(result["exact_match"])
    return MetricResult(
        name="exact_match",
        score=score,
        grade=compute_grade(score),
        details={"exact_match": score, "n": len(predictions)},
    )


def compute_f1(predictions: list[str], references: list[str]) -> MetricResult:
    """Compute token-level F1 (text overlap), averaged across all pairs."""
    f1_scores = []
    precision_scores = []
    recall_scores = []
    for pred, ref in zip(predictions, references, strict=False):
        f1, prec, rec = _token_f1_precision_recall(pred, ref)
        f1_scores.append(f1)
        precision_scores.append(prec)
        recall_scores.append(rec)
    avg_f1 = float(np.mean(f1_scores)) if f1_scores else 0.0
    avg_prec = float(np.mean(precision_scores)) if precision_scores else 0.0
    avg_rec = float(np.mean(recall_scores)) if recall_scores else 0.0
    return MetricResult(
        name="f1",
        score=avg_f1,
        grade=compute_grade(avg_f1),
        details={"f1": avg_f1, "precision": avg_prec, "recall": avg_rec, "n": len(predictions)},
    )


def compute_precision(predictions: list[str], references: list[str]) -> MetricResult:
    """Compute token-level precision averaged across all pairs."""
    precision_scores = []
    for pred, ref in zip(predictions, references, strict=False):
        _, prec, _ = _token_f1_precision_recall(pred, ref)
        precision_scores.append(prec)
    score = float(np.mean(precision_scores)) if precision_scores else 0.0
    return MetricResult(
        name="precision",
        score=score,
        grade=compute_grade(score),
        details={"precision": score, "n": len(predictions)},
    )


def compute_recall(predictions: list[str], references: list[str]) -> MetricResult:
    """Compute token-level recall averaged across all pairs."""
    recall_scores = []
    for pred, ref in zip(predictions, references, strict=False):
        _, _, rec = _token_f1_precision_recall(pred, ref)
        recall_scores.append(rec)
    score = float(np.mean(recall_scores)) if recall_scores else 0.0
    return MetricResult(
        name="recall",
        score=score,
        grade=compute_grade(score),
        details={"recall": score, "n": len(predictions)},
    )


def compute_bleu(predictions: list[str], references: list[str]) -> MetricResult:
    """Compute BLEU score using HuggingFace evaluate."""
    import evaluate  # type: ignore[import-untyped]

    bleu_metric = evaluate.load("bleu")
    # HuggingFace evaluate BLEU expects references as list of lists
    refs = [[ref] for ref in references]
    result = bleu_metric.compute(predictions=predictions, references=refs)
    score = float(result["bleu"])
    return MetricResult(
        name="bleu",
        score=score,
        grade=compute_grade(score),
        details={
            "bleu": score,
            "precisions": result.get("precisions", []),
            "brevity_penalty": result.get("brevity_penalty", 1.0),
            "n": len(predictions),
        },
    )


def compute_rouge(predictions: list[str], references: list[str]) -> MetricResult:
    """Compute ROUGE score using HuggingFace evaluate (rouge1, rouge2, rougeL)."""
    import evaluate  # type: ignore[import-untyped]

    rouge_metric = evaluate.load("rouge")
    result = rouge_metric.compute(predictions=predictions, references=references)
    rouge1 = float(result["rouge1"])
    rouge2 = float(result["rouge2"])
    rouge_l = float(result["rougeL"])
    # Use rougeL as primary score
    score = rouge_l
    return MetricResult(
        name="rouge",
        score=score,
        grade=compute_grade(score),
        details={
            "rouge1": rouge1,
            "rouge2": rouge2,
            "rougeL": rouge_l,
            "n": len(predictions),
        },
    )


def compute_bertscore(predictions: list[str], references: list[str]) -> MetricResult:
    """Compute BERTScore using HuggingFace evaluate."""
    import evaluate  # type: ignore[import-untyped]

    bertscore_metric = evaluate.load("bertscore")
    result = bertscore_metric.compute(
        predictions=predictions,
        references=references,
        lang="en",
        model_type="distilbert-base-uncased",
    )
    f1_scores = result["f1"]
    score = float(np.mean(f1_scores))
    return MetricResult(
        name="bertscore",
        score=score,
        grade=compute_grade(score),
        details={
            "precision": float(np.mean(result["precision"])),
            "recall": float(np.mean(result["recall"])),
            "f1": score,
            "n": len(predictions),
        },
    )


def compute_accuracy(predictions: list[str], references: list[str]) -> MetricResult:
    """Compute accuracy as exact string match ratio."""
    if not predictions:
        return MetricResult(name="accuracy", score=0.0, grade="F", details={"n": 0})
    correct = sum(p.strip() == r.strip() for p, r in zip(predictions, references, strict=False))
    score = correct / len(predictions)
    return MetricResult(
        name="accuracy",
        score=score,
        grade=compute_grade(score),
        details={"correct": correct, "total": len(predictions), "accuracy": score},
    )


def compute_fluency(predictions: list[str]) -> MetricResult:
    """Approximate fluency as avg normalised word count per sentence.

    Heuristic: longer, well-formed sentences → higher fluency proxy.
    Score = min(1.0, avg_words / 20) — a 20-word response is considered fully fluent.
    """
    if not predictions:
        return MetricResult(name="fluency_score", score=0.0, grade="F", details={"n": 0})
    word_counts = [len(_tokenize(p)) for p in predictions]
    avg_words = float(np.mean(word_counts))
    score = min(1.0, avg_words / 20.0)
    return MetricResult(
        name="fluency_score",
        score=score,
        grade=compute_grade(score),
        details={"avg_words": avg_words, "n": len(predictions)},
    )


def compute_grammar(predictions: list[str]) -> MetricResult:
    """Approximate grammar score as ratio of non-empty, punctuated responses.

    Heuristic: response ends with sentence-ending punctuation → syntactically complete.
    """
    if not predictions:
        return MetricResult(name="grammar_score", score=0.0, grade="F", details={"n": 0})
    punctuated = sum(1 for p in predictions if p.strip() and p.strip()[-1] in ".!?")
    score = punctuated / len(predictions)
    return MetricResult(
        name="grammar_score",
        score=score,
        grade=compute_grade(score),
        details={"punctuated": punctuated, "total": len(predictions)},
    )


def compute_response_variance(predictions: list[str]) -> MetricResult:
    """Compute response length variance, normalised to 0-1 (lower variance = higher score)."""
    if not predictions:
        return MetricResult(name="response_variance", score=0.0, grade="F", details={"n": 0})
    lengths = [len(_tokenize(p)) for p in predictions]
    std = float(np.std(lengths)) if len(lengths) > 1 else 0.0
    # Normalize: std=0 → score=1.0 (perfectly consistent), std>=20 → score=0.0
    score = max(0.0, 1.0 - std / 20.0)
    return MetricResult(
        name="response_variance",
        score=score,
        grade=compute_grade(score),
        details={"std_words": std, "mean_words": float(np.mean(lengths)), "n": len(predictions)},
    )


def compute_perplexity(scores: list[float]) -> MetricResult:
    """Compute perplexity from avg log-probs per token.

    scores = list of avg log-prob per token (or 0.0 if unavailable).
    perplexity = exp(-mean(log_probs)); lower is better.
    Normalize to 0-1 via 1/perplexity capped at 1.
    """
    if not scores:
        return MetricResult(
            name="perplexity", score=0.0, grade="F", details={"perplexity": float("inf")}
        )
    valid_scores = [s for s in scores if s != 0.0]
    if not valid_scores:
        return MetricResult(
            name="perplexity", score=0.0, grade="F", details={"perplexity": float("inf")}
        )
    mean_log_prob = float(np.mean(valid_scores))
    perplexity = math.exp(-mean_log_prob)
    normalized = min(1.0, 1.0 / perplexity) if perplexity > 0 else 0.0
    return MetricResult(
        name="perplexity",
        score=normalized,
        grade=compute_grade(normalized),
        details={"perplexity": perplexity, "mean_log_prob": mean_log_prob, "n": len(valid_scores)},
    )


def compute_consistency(variance_scores: list[float]) -> MetricResult:
    """Compute consistency from cosine/Jaccard similarity between runs.

    variance_scores = list of similarity scores; higher = more consistent.
    score = mean(variance_scores).
    """
    if not variance_scores:
        return MetricResult(name="consistency_score", score=0.0, grade="F", details={"n": 0})
    score = float(np.mean(variance_scores))
    return MetricResult(
        name="consistency_score",
        score=score,
        grade=compute_grade(score),
        details={"mean_similarity": score, "n": len(variance_scores)},
    )


def compute_latency_percentiles(latencies_s: list[float]) -> dict[str, float]:
    """Return p50, p90, p99 latency percentiles in seconds."""
    if not latencies_s:
        return {"p50": 0.0, "p90": 0.0, "p99": 0.0}
    arr = np.array(latencies_s)
    return {
        "p50": float(np.percentile(arr, 50)),
        "p90": float(np.percentile(arr, 90)),
        "p99": float(np.percentile(arr, 99)),
    }


def compute_processing_speed(total_tokens: int, total_seconds: float) -> float:
    """Return tokens per second."""
    if total_seconds <= 0:
        return 0.0
    return total_tokens / total_seconds


# ---------------------------------------------------------------------------
# Aggregate compute_metrics
# ---------------------------------------------------------------------------

_METRIC_NEEDS_REFS = {
    "exact_match",
    "f1",
    "precision",
    "recall",
    "bleu",
    "rouge",
    "bertscore",
    "accuracy",
}


def compute_metrics(
    metric_names: list[str],
    predictions: list[str],
    references: list[str] | None,
    log_probs: list[float] | None,
    consistency_similarities: list[float] | None,
    latencies_s: list[float],
    total_tokens: int,
    total_seconds: float,
    total_input_tokens: int = 0,
    total_output_tokens: int = 0,
    model_name: str = "",
) -> list[MetricResult]:
    """Compute all requested metrics and return results."""
    results: list[MetricResult] = []

    for metric in metric_names:
        name = metric.lower()

        # --- Reference-based quality metrics ---
        if name in _METRIC_NEEDS_REFS:
            if references is None or len(references) == 0:
                continue
            if name == "exact_match":
                results.append(compute_exact_match(predictions, references))
            elif name == "f1":
                results.append(compute_f1(predictions, references))
            elif name == "precision":
                results.append(compute_precision(predictions, references))
            elif name == "recall":
                results.append(compute_recall(predictions, references))
            elif name == "bleu":
                results.append(compute_bleu(predictions, references))
            elif name == "rouge":
                results.append(compute_rouge(predictions, references))
            elif name == "bertscore":
                results.append(compute_bertscore(predictions, references))
            elif name == "accuracy":
                results.append(compute_accuracy(predictions, references))

        # --- Coherence / style (no refs needed) ---
        elif name == "fluency_score":
            results.append(compute_fluency(predictions))

        elif name == "grammar_score":
            results.append(compute_grammar(predictions))

        elif name == "perplexity":
            if log_probs is not None:
                results.append(compute_perplexity(log_probs))

        # --- Consistency ---
        elif name == "consistency_score":
            if consistency_similarities is not None:
                results.append(compute_consistency(consistency_similarities))

        elif name == "response_variance":
            results.append(compute_response_variance(predictions))

        # --- Speed ---
        elif name == "latency":
            percentiles = compute_latency_percentiles(latencies_s)
            p90 = percentiles["p90"]
            score = max(0.0, 1.0 - p90 / 10.0)
            results.append(
                MetricResult(
                    name="latency",
                    score=score,
                    grade=compute_grade(score),
                    details=percentiles,
                )
            )

        elif name == "throughput":
            speed = compute_processing_speed(total_tokens, total_seconds)
            score = min(1.0, speed / 1000.0)
            results.append(
                MetricResult(
                    name="throughput",
                    score=score,
                    grade=compute_grade(score),
                    details={"tokens_per_second": speed},
                )
            )

        # --- Performance / token counts ---
        elif name == "eval_duration":
            score = max(0.0, 1.0 - total_seconds / 300.0)  # 300s reference
            results.append(
                MetricResult(
                    name="eval_duration",
                    score=score,
                    grade=compute_grade(score),
                    details={"duration_seconds": total_seconds},
                )
            )

        elif name == "input_tokens":
            avg = total_input_tokens / len(predictions) if predictions else 0.0
            score = max(0.0, 1.0 - avg / 4096.0)  # 4096 token reference
            results.append(
                MetricResult(
                    name="input_tokens",
                    score=score,
                    grade=compute_grade(score),
                    details={"total_input_tokens": total_input_tokens, "avg_per_row": avg},
                )
            )

        elif name == "output_tokens":
            avg = total_output_tokens / len(predictions) if predictions else 0.0
            score = min(1.0, avg / 256.0)  # 256 tokens = full response
            results.append(
                MetricResult(
                    name="output_tokens",
                    score=score,
                    grade=compute_grade(score),
                    details={"total_output_tokens": total_output_tokens, "avg_per_row": avg},
                )
            )

        # --- Cost ---
        elif name == "cost_estimate":
            input_price, output_price = cost_per_1m_tokens(model_name)
            cost = (
                total_input_tokens * input_price + total_output_tokens * output_price
            ) / 1_000_000
            # Normalize: $0.01 per eval = score 1.0, $1.00 = score 0.0
            score = max(0.0, 1.0 - cost / 1.0)
            results.append(
                MetricResult(
                    name="cost_estimate",
                    score=score,
                    grade=compute_grade(score),
                    details={
                        "cost_usd": cost,
                        "input_tokens": total_input_tokens,
                        "output_tokens": total_output_tokens,
                    },
                )
            )

        elif name == "cost_per_request":
            input_price, output_price = cost_per_1m_tokens(model_name)
            total_cost = (
                total_input_tokens * input_price + total_output_tokens * output_price
            ) / 1_000_000
            n = len(predictions) if predictions else 1
            cost_per_req = total_cost / n
            score = max(0.0, 1.0 - cost_per_req / 0.01)  # $0.01/request = score 0.0
            results.append(
                MetricResult(
                    name="cost_per_request",
                    score=score,
                    grade=compute_grade(score),
                    details={"cost_per_request_usd": cost_per_req, "n_requests": n},
                )
            )

        # --- Composite ---
        elif name == "overall_efficiency":
            input_price, output_price = cost_per_1m_tokens(model_name)
            cost = (
                total_input_tokens * input_price + total_output_tokens * output_price
            ) / 1_000_000
            speed = compute_processing_speed(total_tokens, total_seconds)
            # quality proxy: average of ref-based scores already computed
            quality_scores = [r.score for r in results if r.name in _METRIC_NEEDS_REFS]
            quality = float(np.mean(quality_scores)) if quality_scores else 0.5
            cost_norm = max(0.0, 1.0 - cost / 1.0)
            speed_norm = min(1.0, speed / 1000.0)
            score = (quality + cost_norm + speed_norm) / 3.0
            results.append(
                MetricResult(
                    name="overall_efficiency",
                    score=score,
                    grade=compute_grade(score),
                    details={"quality": quality, "cost_norm": cost_norm, "speed_norm": speed_norm},
                )
            )

        # --- Sustainability ---
        elif name == "carbon_footprint":
            carbon = estimate_carbon(total_tokens)
            # Normalize: 1 gCO2 = score 0.0, 0 gCO2 = score 1.0; reference 1g
            score = max(0.0, 1.0 - carbon / 1.0)
            results.append(
                MetricResult(
                    name="carbon_footprint",
                    score=score,
                    grade=compute_grade(score),
                    details={"carbon_g_co2": carbon, "total_tokens": total_tokens},
                )
            )

        elif name == "power_consumption":
            power = estimate_power(total_tokens)
            # Normalize: 0.35 mWh/1k tokens; reference 1 mWh = score 0.0
            score = max(0.0, 1.0 - power / 1.0)
            results.append(
                MetricResult(
                    name="power_consumption",
                    score=score,
                    grade=compute_grade(score),
                    details={"power_mwh": power, "total_tokens": total_tokens},
                )
            )

    return results
