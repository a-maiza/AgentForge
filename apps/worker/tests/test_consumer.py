"""Unit tests for app/consumer.py — mocks redis.asyncio entirely."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture()
def mock_redis_client() -> MagicMock:
    client = MagicMock()
    client.aclose = AsyncMock()
    client.blmove = AsyncMock(return_value="job-123")
    # pipeline returns an async context manager
    pipe = AsyncMock()
    pipe.__aenter__ = AsyncMock(return_value=pipe)
    pipe.__aexit__ = AsyncMock(return_value=False)
    pipe.lrem = MagicMock()
    pipe.zadd = MagicMock()
    pipe.execute = AsyncMock(return_value=[1, 1])
    client.pipeline = MagicMock(return_value=pipe)
    return client


@pytest.fixture()
def consumer(mock_redis_client: MagicMock) -> "BullMQConsumer":
    from app.consumer import BullMQConsumer

    c = BullMQConsumer(redis_url="redis://localhost:6379", queue_name="evaluations")
    c._client = mock_redis_client
    return c


class TestBullMQConsumer:
    async def test_connect_creates_redis_client(self) -> None:
        from app.consumer import BullMQConsumer

        with patch("redis.asyncio.from_url") as mock_from_url:
            mock_from_url.return_value = MagicMock()
            c = BullMQConsumer(redis_url="redis://localhost:6379")
            await c.connect()

        mock_from_url.assert_called_once_with(
            "redis://localhost:6379",
            decode_responses=True,
            socket_connect_timeout=10,
        )
        assert c._client is not None

    async def test_close_calls_aclose(self, consumer: "BullMQConsumer", mock_redis_client: MagicMock) -> None:
        await consumer.close()
        mock_redis_client.aclose.assert_called_once()
        assert consumer._client is None

    async def test_close_is_idempotent_when_already_closed(self) -> None:
        from app.consumer import BullMQConsumer

        c = BullMQConsumer(redis_url="redis://localhost:6379")
        # client is None — should not raise
        await c.close()

    async def test_dequeue_returns_job_id(self, consumer: "BullMQConsumer", mock_redis_client: MagicMock) -> None:
        job_id = await consumer.dequeue(timeout=5.0)
        assert job_id == "job-123"
        mock_redis_client.blmove.assert_called_once_with(
            "bull:evaluations:wait",
            "bull:evaluations:active",
            5.0,
            "LEFT",
            "RIGHT",
        )

    async def test_dequeue_returns_none_on_timeout(self, consumer: "BullMQConsumer", mock_redis_client: MagicMock) -> None:
        mock_redis_client.blmove.return_value = None
        result = await consumer.dequeue(timeout=1.0)
        assert result is None

    async def test_dequeue_raises_when_not_connected(self) -> None:
        from app.consumer import BullMQConsumer

        c = BullMQConsumer(redis_url="redis://localhost:6379")
        with pytest.raises(RuntimeError, match="not connected"):
            await c.dequeue()

    async def test_ack_moves_job_to_completed(self, consumer: "BullMQConsumer", mock_redis_client: MagicMock) -> None:
        await consumer.ack("job-123")
        pipe = mock_redis_client.pipeline.return_value
        pipe.lrem.assert_called_once_with("bull:evaluations:active", 0, "job-123")
        pipe.zadd.assert_called_once()
        zadd_args = pipe.zadd.call_args
        assert zadd_args[0][0] == "bull:evaluations:completed"
        assert "job-123" in zadd_args[0][1]

    async def test_ack_raises_when_not_connected(self) -> None:
        from app.consumer import BullMQConsumer

        c = BullMQConsumer(redis_url="redis://localhost:6379")
        with pytest.raises(RuntimeError, match="not connected"):
            await c.ack("job-123")

    async def test_nack_moves_job_to_failed(self, consumer: "BullMQConsumer", mock_redis_client: MagicMock) -> None:
        await consumer.nack("job-123", "some error")
        pipe = mock_redis_client.pipeline.return_value
        pipe.lrem.assert_called_once_with("bull:evaluations:active", 0, "job-123")
        pipe.zadd.assert_called_once()
        zadd_args = pipe.zadd.call_args
        assert zadd_args[0][0] == "bull:evaluations:failed"

    async def test_nack_raises_when_not_connected(self) -> None:
        from app.consumer import BullMQConsumer

        c = BullMQConsumer(redis_url="redis://localhost:6379")
        with pytest.raises(RuntimeError, match="not connected"):
            await c.nack("job-123", "error")

    def test_queue_keys_use_correct_names(self) -> None:
        from app.consumer import BullMQConsumer

        c = BullMQConsumer(redis_url="redis://localhost:6379", queue_name="my-queue")
        assert c._wait_key == "bull:my-queue:wait"
        assert c._active_key == "bull:my-queue:active"
        assert c._completed_key == "bull:my-queue:completed"
        assert c._failed_key == "bull:my-queue:failed"
