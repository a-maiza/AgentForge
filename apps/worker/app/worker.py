import asyncio
import csv
import io
import json
import logging
import time
import uuid
from datetime import UTC, datetime

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.consumer import BullMQConsumer
from app.crypto import decrypt_api_key
from app.database import async_session_factory
from app.executor import RowResult, execute_consistency_check, execute_row
from app.metrics.cost import estimate_cost
from app.metrics.grade import compute_overall_grade
from app.metrics.scorers import MetricResult, compute_metrics
from app.models import (
    AiProvider,
    DatasetVersion,
    EvaluationJob,
    EvaluationResult,
    PromptDatasetConfig,
    PromptVersion,
)
from app.storage import download_dataset

logger = logging.getLogger(__name__)

_REFERENCE_KEYS = {"expected", "reference", "output", "answer", "label", "ground_truth"}


def _find_reference(row: dict[str, object]) -> str | None:
    """Look for a reference/ground-truth key in a dataset row."""
    for key in _REFERENCE_KEYS:
        if key in row:
            return str(row[key])
    return None


def _parse_dataset(data: bytes, storage_path: str) -> list[dict[str, object]]:
    """Parse CSV or JSON/JSONL bytes into a list of row dicts."""
    path_lower = storage_path.lower()
    if path_lower.endswith(".csv"):
        text = data.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        return [dict(row) for row in reader]
    if path_lower.endswith(".jsonl"):
        lines = data.decode("utf-8").strip().splitlines()
        return [json.loads(line) for line in lines if line.strip()]
    # .json — try array first, then JSONL fallback
    try:
        parsed = json.loads(data.decode("utf-8"))
        if isinstance(parsed, list):
            return parsed
        return [parsed]
    except json.JSONDecodeError:
        lines = data.decode("utf-8").strip().splitlines()
        return [json.loads(line) for line in lines if line.strip()]


async def _publish_progress(
    redis_client: aioredis.Redis,  # type: ignore[type-arg]
    job_id: str,
    progress: int,
    status: str,
) -> None:
    payload = json.dumps({"jobId": job_id, "progress": progress, "status": status})
    await redis_client.publish("eval.progress", payload)


async def process_job(job_id: str, db: AsyncSession) -> None:
    """Full evaluation job pipeline."""
    redis_client: aioredis.Redis = aioredis.from_url(  # type: ignore[type-arg]
        settings.redis_url, decode_responses=True
    )
    try:
        await _run_job(job_id, db, redis_client)
    finally:
        await redis_client.aclose()


async def _run_job(
    job_id: str,
    db: AsyncSession,
    redis_client: aioredis.Redis,  # type: ignore[type-arg]
) -> None:
    now = datetime.now(tz=UTC)

    # 1. Load EvaluationJob
    job_uuid = uuid.UUID(job_id)
    stmt = select(EvaluationJob).where(EvaluationJob.id == job_uuid)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if job is None:
        logger.error("Job %s not found in DB", job_id)
        return

    # 2. Update status → running
    job.status = "running"
    job.started_at = now
    job.progress = 0
    await db.commit()
    await _publish_progress(redis_client, job_id, 0, "running")

    try:
        # 3. Load related records
        pv_stmt = select(PromptVersion).where(PromptVersion.id == job.prompt_version_id)
        ds_stmt = select(DatasetVersion).where(DatasetVersion.id == job.dataset_version_id)
        ap_stmt = select(AiProvider).where(AiProvider.id == job.provider_id)
        pdc_stmt = select(PromptDatasetConfig).where(
            PromptDatasetConfig.prompt_id == job.prompt_id,
            PromptDatasetConfig.dataset_id == job.dataset_id,
        )

        pv_res = await db.execute(pv_stmt)
        ds_res = await db.execute(ds_stmt)
        ap_res = await db.execute(ap_stmt)
        pdc_res = await db.execute(pdc_stmt)

        prompt_version = pv_res.scalar_one_or_none()
        dataset_version = ds_res.scalar_one_or_none()
        ai_provider = ap_res.scalar_one_or_none()
        pdc = pdc_res.scalar_one_or_none()

        if prompt_version is None:
            raise ValueError(f"PromptVersion {job.prompt_version_id} not found")
        if dataset_version is None:
            raise ValueError(f"DatasetVersion {job.dataset_version_id} not found")
        if ai_provider is None:
            raise ValueError(f"AiProvider {job.provider_id} not found")

        variable_mapping: dict[str, str] = {}
        if pdc and pdc.variable_mapping:
            variable_mapping = dict(pdc.variable_mapping)

        # 4. Decrypt API key
        api_key = decrypt_api_key(ai_provider.api_key_encrypted, settings.encryption_key)

        # 5. Download dataset
        raw_bytes = await download_dataset(dataset_version.storage_path)
        rows = _parse_dataset(raw_bytes, dataset_version.storage_path)
        total_rows = len(rows)
        if total_rows == 0:
            raise ValueError("Dataset has no rows")

        model_cfg: dict[str, object] = {}
        if job.model_config:
            model_cfg = dict(job.model_config)

        # 6. Execute rows
        row_results: list[RowResult] = []
        predictions: list[str] = []
        references: list[str] = []
        has_references = False

        start_time = time.perf_counter()

        for idx, row in enumerate(rows):
            row_result = await execute_row(
                prompt_template=prompt_version.content,
                row=row,
                variable_mapping=variable_mapping,
                model_name=job.model_name,
                model_config=model_cfg,
                api_key=api_key,
                provider_type=ai_provider.provider_type,
                base_url=ai_provider.base_url,
                row_index=idx,
            )
            row_results.append(row_result)
            predictions.append(row_result.prediction)

            ref = _find_reference(row)
            if ref is not None:
                has_references = True
                references.append(ref)
            else:
                references.append("")

            # Update progress
            progress = int((idx + 1) / total_rows * 100)
            if total_rows < 10 or (idx + 1) % 10 == 0 or idx + 1 == total_rows:
                job.progress = progress
                await db.commit()
                await _publish_progress(redis_client, job_id, progress, "running")

        total_seconds = time.perf_counter() - start_time

        # 7. Consistency check
        consistency_similarities: list[float] | None = None
        requested_metrics: list[str] = list(job.metrics or [])
        if "consistency_score" in requested_metrics:
            sample_size = min(settings.consistency_sample_size, len(rows))
            sample_rows = rows[:sample_size]
            consistency_similarities = await execute_consistency_check(
                prompt_template=prompt_version.content,
                sample_rows=sample_rows,
                variable_mapping=variable_mapping,
                model_name=job.model_name,
                model_config=model_cfg,
                api_key=api_key,
                provider_type=ai_provider.provider_type,
                base_url=ai_provider.base_url,
                n_runs=settings.consistency_runs,
            )

        # 8. Compute metrics
        latencies_s = [r.latency_s for r in row_results]
        total_tokens = sum(r.input_tokens + r.output_tokens for r in row_results)
        log_probs = [r.log_prob for r in row_results if r.log_prob is not None]
        final_log_probs: list[float] | None = log_probs if log_probs else None
        final_references: list[str] | None = references if has_references else None

        metric_results: list[MetricResult] = compute_metrics(
            metric_names=requested_metrics,
            predictions=predictions,
            references=final_references,
            log_probs=final_log_probs,
            consistency_similarities=consistency_similarities,
            latencies_s=latencies_s,
            total_tokens=total_tokens,
            total_seconds=total_seconds,
        )

        # Compute cost/carbon as extra details (not stored as separate metrics by default)
        total_input_tokens = sum(r.input_tokens for r in row_results)
        total_output_tokens = sum(r.output_tokens for r in row_results)
        estimated_cost = estimate_cost(job.model_name, total_input_tokens, total_output_tokens)
        logger.info("Job %s estimated cost: $%.6f", job_id, estimated_cost)

        # 9. Insert EvaluationResult rows
        for mr in metric_results:
            eval_result = EvaluationResult(
                id=uuid.uuid4(),
                job_id=job_uuid,
                metric_name=mr.name,
                score=mr.score,
                grade=mr.grade,
                threshold=None,
                details=mr.details,
            )
            db.add(eval_result)

        # 10. Compute overall grade
        metric_scores = {mr.name: mr.score for mr in metric_results}
        overall_grade = compute_overall_grade(metric_scores) if metric_scores else "F"

        # 11. Update job: completed
        job.status = "completed"
        job.grade = overall_grade
        job.completed_at = datetime.now(tz=UTC)
        job.progress = 100
        job.error_message = None
        await db.commit()
        await _publish_progress(redis_client, job_id, 100, "completed")
        logger.info("Job %s completed with grade %s", job_id, overall_grade)

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = datetime.now(tz=UTC)
        try:
            await db.commit()
        except Exception:
            await db.rollback()
        await _publish_progress(redis_client, job_id, job.progress, "failed")
        raise


async def run_consumer_loop() -> None:
    """Infinite loop: dequeue → process_job → ack/nack."""
    consumer = BullMQConsumer(redis_url=settings.redis_url, queue_name="evaluations")
    await consumer.connect()
    logger.info("BullMQ consumer started, listening on bull:evaluations:wait")

    try:
        while True:
            try:
                job_id = await consumer.dequeue(timeout=5.0)
                if job_id is None:
                    continue
                logger.info("Dequeued job %s", job_id)
                async with async_session_factory() as db:
                    try:
                        await process_job(job_id, db)
                        await consumer.ack(job_id)
                        logger.info("Acked job %s", job_id)
                    except Exception as exc:
                        logger.error("Job %s failed, nacking: %s", job_id, exc)
                        await consumer.nack(job_id, str(exc))
            except asyncio.CancelledError:
                logger.info("Consumer loop cancelled")
                break
            except Exception as exc:
                logger.exception("Unexpected error in consumer loop: %s", exc)
                await asyncio.sleep(1)
    finally:
        await consumer.close()
        logger.info("BullMQ consumer closed")
