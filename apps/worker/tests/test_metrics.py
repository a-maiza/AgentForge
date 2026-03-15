"""Unit tests for metrics module — no async needed for pure functions."""

import os

import pytest
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.crypto import decrypt_api_key
from app.metrics.carbon import estimate_carbon, estimate_power
from app.metrics.cost import DEFAULT_PRICING, cost_per_1m_tokens, estimate_cost
from app.metrics.grade import compute_grade, compute_overall_grade
from app.metrics.scorers import (
    compute_accuracy,
    compute_bleu,
    compute_consistency,
    compute_exact_match,
    compute_f1,
    compute_latency_percentiles,
    compute_metrics,
    compute_perplexity,
    compute_processing_speed,
)

# ---------------------------------------------------------------------------
# compute_grade
# ---------------------------------------------------------------------------


class TestComputeGrade:
    def test_a_plus(self) -> None:
        assert compute_grade(0.95) == "A+"
        assert compute_grade(1.0) == "A+"
        assert compute_grade(0.99) == "A+"

    def test_a(self) -> None:
        assert compute_grade(0.90) == "A"
        assert compute_grade(0.94) == "A"

    def test_b(self) -> None:
        assert compute_grade(0.80) == "B"
        assert compute_grade(0.89) == "B"

    def test_c(self) -> None:
        assert compute_grade(0.70) == "C"
        assert compute_grade(0.79) == "C"

    def test_d(self) -> None:
        assert compute_grade(0.60) == "D"
        assert compute_grade(0.69) == "D"

    def test_f(self) -> None:
        assert compute_grade(0.0) == "F"
        assert compute_grade(0.59) == "F"


# ---------------------------------------------------------------------------
# compute_overall_grade
# ---------------------------------------------------------------------------


class TestComputeOverallGrade:
    def test_average_scores(self) -> None:
        # avg = 0.85 → B
        assert compute_overall_grade({"f1": 0.80, "bleu": 0.90}) == "B"

    def test_single_score(self) -> None:
        assert compute_overall_grade({"exact_match": 0.95}) == "A+"

    def test_empty(self) -> None:
        assert compute_overall_grade({}) == "F"

    def test_all_perfect(self) -> None:
        assert compute_overall_grade({"f1": 1.0, "bleu": 1.0, "rouge": 1.0}) == "A+"


# ---------------------------------------------------------------------------
# estimate_cost
# ---------------------------------------------------------------------------


class TestEstimateCost:
    def test_gpt4o(self) -> None:
        # 1M input tokens at $5/M + 1M output at $15/M = $20
        cost = estimate_cost("gpt-4o", 1_000_000, 1_000_000)
        assert abs(cost - 20.0) < 0.001

    def test_gpt35_turbo(self) -> None:
        # 1k input at $0.5/M + 1k output at $1.5/M = very small
        cost = estimate_cost("gpt-3.5-turbo", 1000, 1000)
        assert cost == pytest.approx(0.002, rel=1e-3)

    def test_unknown_model_uses_default(self) -> None:
        pricing = cost_per_1m_tokens("unknown-model-xyz")
        assert pricing == DEFAULT_PRICING

    def test_zero_tokens(self) -> None:
        assert estimate_cost("gpt-4o", 0, 0) == 0.0

    def test_prefix_matching(self) -> None:
        # "gpt-4o-mini" should match "gpt-4o" prefix
        pricing = cost_per_1m_tokens("gpt-4o-mini")
        assert pricing == (5.0, 15.0)

    def test_claude_haiku(self) -> None:
        # 1M + 1M tokens for claude-3-haiku: (0.25 + 1.25) = 1.5
        cost = estimate_cost("claude-3-haiku", 1_000_000, 1_000_000)
        assert abs(cost - 1.5) < 0.001


# ---------------------------------------------------------------------------
# estimate_carbon / estimate_power
# ---------------------------------------------------------------------------


class TestCarbon:
    def test_estimate_carbon_1k_tokens(self) -> None:
        assert estimate_carbon(1000) == pytest.approx(0.5)

    def test_estimate_carbon_zero(self) -> None:
        assert estimate_carbon(0) == 0.0

    def test_estimate_power_1k_tokens(self) -> None:
        assert estimate_power(1000) == pytest.approx(0.35)

    def test_estimate_power_zero(self) -> None:
        assert estimate_power(0) == 0.0

    def test_proportional(self) -> None:
        assert estimate_carbon(2000) == pytest.approx(2 * estimate_carbon(1000))
        assert estimate_power(2000) == pytest.approx(2 * estimate_power(1000))


# ---------------------------------------------------------------------------
# compute_exact_match
# ---------------------------------------------------------------------------


class TestExactMatch:
    def test_all_match(self) -> None:
        result = compute_exact_match(["hello world", "foo"], ["hello world", "foo"])
        assert result.score == pytest.approx(1.0)
        assert result.name == "exact_match"
        assert result.grade == "A+"

    def test_none_match(self) -> None:
        result = compute_exact_match(["hello", "world"], ["bye", "earth"])
        assert result.score == pytest.approx(0.0)
        assert result.grade == "F"

    def test_partial_match(self) -> None:
        result = compute_exact_match(["hello", "world"], ["hello", "earth"])
        assert result.score == pytest.approx(0.5)

    def test_single_pair(self) -> None:
        result = compute_exact_match(["The answer is 42"], ["The answer is 42"])
        assert result.score == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# compute_f1
# ---------------------------------------------------------------------------


class TestF1:
    def test_perfect_match(self) -> None:
        result = compute_f1(["hello world foo"], ["hello world foo"])
        assert result.score == pytest.approx(1.0)
        assert result.name == "f1"

    def test_no_overlap(self) -> None:
        result = compute_f1(["aaa bbb"], ["ccc ddd"])
        assert result.score == pytest.approx(0.0)

    def test_partial_overlap(self) -> None:
        result = compute_f1(["the cat sat"], ["the cat"])
        # pred tokens: [the, cat, sat]; ref tokens: [the, cat]
        # common = 2, precision = 2/3, recall = 2/2 = 1
        # f1 = 2 * (2/3) * 1 / (2/3 + 1) = (4/3) / (5/3) = 4/5 = 0.8
        assert result.score == pytest.approx(0.8, rel=1e-3)

    def test_details_present(self) -> None:
        result = compute_f1(["hello"], ["hello"])
        assert "precision" in result.details
        assert "recall" in result.details
        assert "f1" in result.details


# ---------------------------------------------------------------------------
# compute_bleu
# ---------------------------------------------------------------------------


class TestBleu:
    def test_perfect_bleu(self) -> None:
        result = compute_bleu(["the cat is on the mat"], ["the cat is on the mat"])
        assert result.score == pytest.approx(1.0)
        assert result.name == "bleu"

    def test_zero_bleu(self) -> None:
        result = compute_bleu(["zzz yyy xxx"], ["aaa bbb ccc"])
        assert result.score == pytest.approx(0.0)

    def test_bleu_details(self) -> None:
        result = compute_bleu(["hello world"], ["hello world"])
        assert "brevity_penalty" in result.details

    def test_multiple_pairs(self) -> None:
        preds = ["the cat sat on the mat", "there is a cat on the mat"]
        refs = ["the cat is on the mat", "the cat sat on the mat"]
        result = compute_bleu(preds, refs)
        assert 0.0 <= result.score <= 1.0


# ---------------------------------------------------------------------------
# compute_accuracy
# ---------------------------------------------------------------------------


class TestAccuracy:
    def test_all_correct(self) -> None:
        result = compute_accuracy(["yes", "no"], ["yes", "no"])
        assert result.score == pytest.approx(1.0)
        assert result.name == "accuracy"

    def test_none_correct(self) -> None:
        result = compute_accuracy(["yes", "yes"], ["no", "no"])
        assert result.score == pytest.approx(0.0)

    def test_empty(self) -> None:
        result = compute_accuracy([], [])
        assert result.score == pytest.approx(0.0)

    def test_strips_whitespace(self) -> None:
        result = compute_accuracy([" yes "], ["yes"])
        assert result.score == pytest.approx(1.0)

    def test_half_correct(self) -> None:
        result = compute_accuracy(["yes", "no"], ["yes", "yes"])
        assert result.score == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# compute_latency_percentiles
# ---------------------------------------------------------------------------


class TestLatencyPercentiles:
    def test_basic(self) -> None:
        latencies = [0.1, 0.2, 0.3, 0.4, 0.5]
        result = compute_latency_percentiles(latencies)
        assert "p50" in result
        assert "p90" in result
        assert "p99" in result
        assert result["p50"] == pytest.approx(0.3, rel=1e-3)

    def test_empty(self) -> None:
        result = compute_latency_percentiles([])
        assert result == {"p50": 0.0, "p90": 0.0, "p99": 0.0}

    def test_single_value(self) -> None:
        result = compute_latency_percentiles([1.5])
        assert result["p50"] == pytest.approx(1.5)
        assert result["p90"] == pytest.approx(1.5)
        assert result["p99"] == pytest.approx(1.5)

    def test_percentile_ordering(self) -> None:
        latencies = list(range(1, 101))  # 1..100 seconds
        result = compute_latency_percentiles([float(x) for x in latencies])
        assert result["p50"] <= result["p90"] <= result["p99"]


# ---------------------------------------------------------------------------
# compute_processing_speed
# ---------------------------------------------------------------------------


class TestProcessingSpeed:
    def test_basic(self) -> None:
        speed = compute_processing_speed(1000, 2.0)
        assert speed == pytest.approx(500.0)

    def test_zero_seconds(self) -> None:
        assert compute_processing_speed(1000, 0.0) == 0.0

    def test_zero_tokens(self) -> None:
        assert compute_processing_speed(0, 5.0) == 0.0


# ---------------------------------------------------------------------------
# compute_perplexity
# ---------------------------------------------------------------------------


class TestPerplexity:
    def test_low_perplexity_high_score(self) -> None:
        # log_prob close to 0 → perplexity close to 1 → normalized score close to 1
        result = compute_perplexity([-0.01, -0.02, -0.01])
        assert result.name == "perplexity"
        assert result.score > 0.5

    def test_empty(self) -> None:
        result = compute_perplexity([])
        assert result.score == 0.0

    def test_all_zeros(self) -> None:
        result = compute_perplexity([0.0, 0.0])
        assert result.score == 0.0


# ---------------------------------------------------------------------------
# compute_consistency
# ---------------------------------------------------------------------------


class TestConsistency:
    def test_perfect_consistency(self) -> None:
        result = compute_consistency([1.0, 1.0, 1.0])
        assert result.score == pytest.approx(1.0)
        assert result.name == "consistency_score"

    def test_zero_consistency(self) -> None:
        result = compute_consistency([0.0, 0.0, 0.0])
        assert result.score == pytest.approx(0.0)

    def test_empty(self) -> None:
        result = compute_consistency([])
        assert result.score == 0.0

    def test_partial(self) -> None:
        result = compute_consistency([0.8, 0.9, 0.7])
        assert result.score == pytest.approx(0.8, rel=1e-3)


# ---------------------------------------------------------------------------
# compute_metrics integration
# ---------------------------------------------------------------------------


class TestComputeMetrics:
    def test_multiple_metrics(self) -> None:
        preds = ["the cat sat on the mat", "hello world"]
        refs = ["the cat sat on the mat", "hello world"]
        results = compute_metrics(
            metric_names=["exact_match", "f1", "accuracy"],
            predictions=preds,
            references=refs,
            log_probs=None,
            consistency_similarities=None,
            latencies_s=[0.1, 0.2],
            total_tokens=100,
            total_seconds=1.0,
        )
        names = {r.name for r in results}
        assert "exact_match" in names
        assert "f1" in names
        assert "accuracy" in names

    def test_skip_quality_metrics_without_references(self) -> None:
        preds = ["some prediction"]
        results = compute_metrics(
            metric_names=["exact_match", "f1", "bleu", "rouge"],
            predictions=preds,
            references=None,
            log_probs=None,
            consistency_similarities=None,
            latencies_s=[0.1],
            total_tokens=50,
            total_seconds=0.5,
        )
        assert results == []

    def test_latency_metric(self) -> None:
        results = compute_metrics(
            metric_names=["latency"],
            predictions=["x"],
            references=None,
            log_probs=None,
            consistency_similarities=None,
            latencies_s=[0.5, 1.0, 1.5],
            total_tokens=100,
            total_seconds=3.0,
        )
        assert len(results) == 1
        assert results[0].name == "latency"
        assert 0.0 <= results[0].score <= 1.0

    def test_throughput_metric(self) -> None:
        results = compute_metrics(
            metric_names=["throughput"],
            predictions=["x"],
            references=None,
            log_probs=None,
            consistency_similarities=None,
            latencies_s=[1.0],
            total_tokens=500,
            total_seconds=1.0,
        )
        assert len(results) == 1
        assert results[0].name == "throughput"
        assert results[0].details["tokens_per_second"] == pytest.approx(500.0)

    def test_perplexity_metric(self) -> None:
        results = compute_metrics(
            metric_names=["perplexity"],
            predictions=["x"],
            references=None,
            log_probs=[-0.5, -0.3, -0.4],
            consistency_similarities=None,
            latencies_s=[0.1],
            total_tokens=50,
            total_seconds=0.3,
        )
        assert len(results) == 1
        assert results[0].name == "perplexity"

    def test_consistency_metric(self) -> None:
        results = compute_metrics(
            metric_names=["consistency_score"],
            predictions=["x"],
            references=None,
            log_probs=None,
            consistency_similarities=[0.85, 0.90],
            latencies_s=[0.1],
            total_tokens=50,
            total_seconds=0.2,
        )
        assert len(results) == 1
        assert results[0].name == "consistency_score"

    @pytest.mark.skip(reason="downloads model, run manually")
    def test_bertscore(self) -> None:
        from app.metrics.scorers import compute_bertscore

        result = compute_bertscore(["hello world"], ["hello world"])
        assert result.score > 0.5
        assert result.name == "bertscore"


# ---------------------------------------------------------------------------
# decrypt_api_key
# ---------------------------------------------------------------------------


class TestDecryptApiKey:
    def test_round_trip(self) -> None:
        """Encrypt with Python cryptography, decrypt with our function."""
        key_bytes = os.urandom(32)
        iv = os.urandom(12)
        plaintext = "sk-test-api-key-12345"

        aesgcm = AESGCM(key_bytes)
        encrypted_bytes = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
        # AESGCM appends auth tag (last 16 bytes) to ciphertext
        ciphertext = encrypted_bytes[:-16]
        auth_tag = encrypted_bytes[-16:]

        encrypted_str = f"{iv.hex()}:{auth_tag.hex()}:{ciphertext.hex()}"
        hex_key = key_bytes.hex()

        result = decrypt_api_key(encrypted_str, hex_key)
        assert result == plaintext

    def test_invalid_format_raises(self) -> None:
        with pytest.raises(ValueError, match="3 colon-separated parts"):
            decrypt_api_key("only:two", "a" * 64)

    def test_wrong_key_raises(self) -> None:
        key_bytes = os.urandom(32)
        wrong_key = os.urandom(32)
        iv = os.urandom(12)
        plaintext = "secret"

        aesgcm = AESGCM(key_bytes)
        encrypted_bytes = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
        ciphertext = encrypted_bytes[:-16]
        auth_tag = encrypted_bytes[-16:]
        encrypted_str = f"{iv.hex()}:{auth_tag.hex()}:{ciphertext.hex()}"

        with pytest.raises(InvalidTag):
            decrypt_api_key(encrypted_str, wrong_key.hex())
