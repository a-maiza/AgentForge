import time

import redis.asyncio as aioredis


class BullMQConsumer:
    """Minimal BullMQ v5 compatible Redis consumer using BLMOVE."""

    def __init__(self, redis_url: str, queue_name: str = "evaluations") -> None:
        self._redis_url = redis_url
        self._queue_name = queue_name
        self._client: aioredis.Redis | None = None  # type: ignore[type-arg]
        self._wait_key = f"bull:{queue_name}:wait"
        self._active_key = f"bull:{queue_name}:active"
        self._completed_key = f"bull:{queue_name}:completed"
        self._failed_key = f"bull:{queue_name}:failed"

    async def connect(self) -> None:
        """Create redis.asyncio connection."""
        self._client = aioredis.from_url(
            self._redis_url,
            decode_responses=True,
            socket_connect_timeout=10,
        )

    async def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def dequeue(self, timeout: float = 5.0) -> str | None:
        """BLMOVE from wait→active, return job_id or None on timeout."""
        if self._client is None:
            raise RuntimeError("BullMQConsumer not connected — call connect() first")
        result = await self._client.blmove(
            self._wait_key,
            self._active_key,
            timeout,
            "LEFT",
            "RIGHT",
        )
        return result  # type: ignore[return-value]

    async def ack(self, job_id: str) -> None:
        """Mark job complete: LREM active, ZADD completed."""
        if self._client is None:
            raise RuntimeError("BullMQConsumer not connected — call connect() first")
        score = float(int(time.time() * 1000))
        async with self._client.pipeline(transaction=True) as pipe:
            pipe.lrem(self._active_key, 0, job_id)
            pipe.zadd(self._completed_key, {job_id: score})
            await pipe.execute()

    async def nack(self, job_id: str, error: str) -> None:
        """Mark job failed: LREM active, ZADD failed."""
        if self._client is None:
            raise RuntimeError("BullMQConsumer not connected — call connect() first")
        score = float(int(time.time() * 1000))
        async with self._client.pipeline(transaction=True) as pipe:
            pipe.lrem(self._active_key, 0, job_id)
            pipe.zadd(self._failed_key, {job_id: score})
            await pipe.execute()
