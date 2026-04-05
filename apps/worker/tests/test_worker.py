"""Unit tests for app/worker.py — mocks DB, Redis, storage, and LiteLLM."""

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.worker import _find_reference, _parse_dataset, _publish_progress


# ---------------------------------------------------------------------------
# _find_reference
# ---------------------------------------------------------------------------


class TestFindReference:
    def test_finds_expected_key(self) -> None:
        assert _find_reference({"expected": "Paris"}) == "Paris"

    def test_finds_reference_key(self) -> None:
        assert _find_reference({"reference": "London"}) == "London"

    def test_finds_output_key(self) -> None:
        assert _find_reference({"output": "Berlin"}) == "Berlin"

    def test_finds_answer_key(self) -> None:
        assert _find_reference({"answer": "Rome"}) == "Rome"

    def test_finds_label_key(self) -> None:
        assert _find_reference({"label": "cat"}) == "cat"

    def test_finds_ground_truth_key(self) -> None:
        assert _find_reference({"ground_truth": "dog"}) == "dog"

    def test_returns_none_when_no_reference_key(self) -> None:
        assert _find_reference({"input": "What is the capital?"}) is None

    def test_converts_non_string_to_string(self) -> None:
        result = _find_reference({"expected": 42})
        assert result == "42"


# ---------------------------------------------------------------------------
# _parse_dataset
# ---------------------------------------------------------------------------


class TestParseDataset:
    def test_parses_csv(self) -> None:
        data = b"name,age\nAlice,30\nBob,25"
        rows = _parse_dataset(data, "data.csv")
        assert len(rows) == 2
        assert rows[0]["name"] == "Alice"
        assert rows[1]["age"] == "25"

    def test_parses_jsonl(self) -> None:
        data = b'{"a":1}\n{"a":2}\n{"a":3}'
        rows = _parse_dataset(data, "data.jsonl")
        assert len(rows) == 3
        assert rows[0] == {"a": 1}

    def test_parses_json_array(self) -> None:
        payload = json.dumps([{"x": 1}, {"x": 2}]).encode()
        rows = _parse_dataset(payload, "data.json")
        assert len(rows) == 2

    def test_parses_json_object_as_single_row(self) -> None:
        payload = json.dumps({"x": 1}).encode()
        rows = _parse_dataset(payload, "data.json")
        assert len(rows) == 1
        assert rows[0]["x"] == 1

    def test_parses_json_file_with_jsonl_fallback(self) -> None:
        # .json extension but JSONL content
        data = b'{"a":1}\n{"a":2}'
        rows = _parse_dataset(data, "data.json")
        assert len(rows) == 2

    def test_skips_blank_lines_in_jsonl(self) -> None:
        data = b'{"a":1}\n\n{"a":2}'
        rows = _parse_dataset(data, "data.jsonl")
        assert len(rows) == 2


# ---------------------------------------------------------------------------
# _publish_progress
# ---------------------------------------------------------------------------


class TestPublishProgress:
    async def test_publishes_json_payload(self) -> None:
        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock()

        await _publish_progress(mock_redis, "job-abc", 50, "running")

        mock_redis.publish.assert_called_once()
        call_args = mock_redis.publish.call_args
        channel = call_args[0][0]
        payload = json.loads(call_args[0][1])

        assert channel == "eval.progress"
        assert payload["jobId"] == "job-abc"
        assert payload["progress"] == 50
        assert payload["status"] == "running"


# ---------------------------------------------------------------------------
# _run_job
# ---------------------------------------------------------------------------


def _make_mock_db(job: MagicMock | None = None) -> MagicMock:
    """Build a mock AsyncSession that returns a pre-built job on first scalar_one_or_none()."""
    db = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.add = MagicMock()
    return db


def _make_job(job_id: str) -> MagicMock:
    job = MagicMock()
    job.id = uuid.UUID(job_id)
    job.status = "pending"
    job.started_at = None
    job.progress = 0
    job.metrics = ["exact_match"]
    job.model_name = "gpt-4o-mini"
    job.model_config = {}
    job.prompt_id = uuid.uuid4()
    job.dataset_id = uuid.uuid4()
    job.prompt_version_id = uuid.uuid4()
    job.dataset_version_id = uuid.uuid4()
    job.provider_id = uuid.uuid4()
    return job


class TestRunJob:
    async def test_job_not_found_returns_early(self) -> None:
        """When the job does not exist in DB, _run_job logs and returns."""
        from app.worker import _run_job

        db = _make_mock_db()
        # scalar_one_or_none returns None (job not found)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result

        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock()

        job_id = str(uuid.uuid4())
        # Should not raise
        await _run_job(job_id, db, mock_redis)

        # Status was never updated since job was None
        db.commit.assert_not_called()

    async def test_job_completes_successfully(self) -> None:
        """Full happy path: CSV dataset, execute_row succeeds, metrics computed."""
        from app.worker import _run_job

        job_id = str(uuid.uuid4())
        job = _make_job(job_id)

        prompt_version = MagicMock()
        prompt_version.content = "Answer: {{question}}"

        dataset_version = MagicMock()
        dataset_version.storage_path = "ws/ds/v1/data.csv"

        ai_provider = MagicMock()
        ai_provider.provider_type = "openai"
        ai_provider.base_url = None
        ai_provider.api_key_encrypted = "aabbcc:ddeeff:112233"

        pdc = MagicMock()
        pdc.variable_mapping = {"question": "q"}

        db = _make_mock_db()
        call_count = 0

        def _scalar(name: str | None = None) -> MagicMock:
            nonlocal call_count
            call_count += 1
            mapping = {1: job, 2: prompt_version, 3: dataset_version, 4: ai_provider, 5: pdc}
            return mapping.get(call_count)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.side_effect = _scalar
        db.execute.return_value = mock_result

        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock()

        from app.executor import RowResult

        fake_row_result = RowResult(
            row_index=0,
            prediction="42",
            input_tokens=5,
            output_tokens=3,
            latency_s=0.1,
            log_prob=None,
            error=None,
        )

        csv_bytes = b"question,expected\nWhat is 6*7?,42"

        with (
            patch("app.worker.download_dataset", new_callable=AsyncMock, return_value=csv_bytes),
            patch("app.worker.decrypt_api_key", return_value="sk-fake"),
            patch("app.worker.execute_row", new_callable=AsyncMock, return_value=fake_row_result),
        ):
            await _run_job(job_id, db, mock_redis)

        assert job.status == "completed"
        assert job.progress == 100

    async def test_job_fails_on_missing_prompt_version(self) -> None:
        """When PromptVersion is not found, job is marked failed."""
        from app.worker import _run_job

        job_id = str(uuid.uuid4())
        job = _make_job(job_id)

        db = _make_mock_db()
        call_count = 0

        def _scalar_seq() -> MagicMock | None:
            nonlocal call_count
            call_count += 1
            # job=found, prompt_version=None → triggers ValueError
            if call_count == 1:
                return job
            return None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.side_effect = _scalar_seq
        db.execute.return_value = mock_result

        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock()

        csv_bytes = b"question,expected\nq1,a1"

        with (
            patch("app.worker.download_dataset", new_callable=AsyncMock, return_value=csv_bytes),
            patch("app.worker.decrypt_api_key", return_value="sk-fake"),
        ):
            with pytest.raises(ValueError, match="not found"):
                await _run_job(job_id, db, mock_redis)

        assert job.status == "failed"

    async def test_process_job_opens_redis_and_calls_run_job(self) -> None:
        """process_job creates a Redis client and calls _run_job."""
        from app.worker import process_job

        db = MagicMock()
        job_id = str(uuid.uuid4())

        mock_redis = MagicMock()
        mock_redis.aclose = AsyncMock()

        with (
            patch("redis.asyncio.from_url", return_value=mock_redis),
            patch("app.worker._run_job", new_callable=AsyncMock) as mock_run,
        ):
            await process_job(job_id, db)

        mock_run.assert_called_once_with(job_id, db, mock_redis)
        mock_redis.aclose.assert_called_once()


# ---------------------------------------------------------------------------
# run_consumer_loop
# ---------------------------------------------------------------------------


class TestRunConsumerLoop:
    async def test_loop_processes_one_job_then_cancels(self) -> None:
        """Consumer loop dequeues one job, processes it, acks, then is cancelled."""
        import asyncio

        from app.worker import run_consumer_loop

        mock_consumer = MagicMock()
        mock_consumer.connect = AsyncMock()
        mock_consumer.close = AsyncMock()
        call_count = 0

        async def dequeue_side_effect(timeout: float = 5.0) -> str | None:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "job-xyz"
            raise asyncio.CancelledError()

        mock_consumer.dequeue = dequeue_side_effect
        mock_consumer.ack = AsyncMock()
        mock_consumer.nack = AsyncMock()

        mock_session = MagicMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_session_factory = MagicMock(return_value=mock_session)

        with (
            patch("app.worker.BullMQConsumer", return_value=mock_consumer),
            patch("app.worker.async_session_factory", mock_session_factory),
            patch("app.worker.process_job", new_callable=AsyncMock),
        ):
            await run_consumer_loop()

        mock_consumer.connect.assert_called_once()
        mock_consumer.ack.assert_called_once_with("job-xyz")
        mock_consumer.close.assert_called_once()
