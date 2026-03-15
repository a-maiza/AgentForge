import asyncio
from typing import Any

import boto3

from app.config import settings


def _download_sync(storage_path: str) -> bytes:
    """Synchronous S3/MinIO download — run in a thread."""
    kwargs: dict[str, Any] = {
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
        "region_name": "us-east-1",
    }
    if settings.use_minio and settings.aws_endpoint_url:
        kwargs["endpoint_url"] = settings.aws_endpoint_url

    s3 = boto3.client("s3", **kwargs)
    response = s3.get_object(Bucket=settings.s3_bucket, Key=storage_path)
    return response["Body"].read()


async def download_dataset(storage_path: str) -> bytes:
    """Download dataset file bytes from S3/MinIO using asyncio.to_thread + boto3."""
    return await asyncio.to_thread(_download_sync, storage_path)
