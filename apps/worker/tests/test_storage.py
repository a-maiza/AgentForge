"""Unit tests for app/storage.py — patches boto3 to avoid real S3 calls."""

from unittest.mock import MagicMock, patch

import pytest


class TestDownloadDataset:
    async def test_returns_bytes_from_s3(self) -> None:
        """download_dataset returns the bytes returned by the S3 client."""
        fake_body = b"col1,col2\n1,2\n3,4"

        mock_response = {"Body": MagicMock(read=MagicMock(return_value=fake_body))}
        mock_s3 = MagicMock()
        mock_s3.get_object.return_value = mock_response

        with patch("boto3.client", return_value=mock_s3):
            from app.storage import download_dataset

            result = await download_dataset("workspaces/ws-1/datasets/ds-1/v1/data.csv")

        assert result == fake_body
        mock_s3.get_object.assert_called_once()

    async def test_uses_minio_endpoint_when_configured(self) -> None:
        """When use_minio=True, boto3.client is called with endpoint_url."""
        mock_response = {"Body": MagicMock(read=MagicMock(return_value=b"data"))}
        mock_s3 = MagicMock()
        mock_s3.get_object.return_value = mock_response

        with (
            patch("boto3.client", return_value=mock_s3) as mock_client,
            patch("app.storage.settings") as mock_settings,
        ):
            mock_settings.use_minio = True
            mock_settings.aws_endpoint_url = "http://localhost:9000"
            mock_settings.aws_access_key_id = "minio"
            mock_settings.aws_secret_access_key = "minio123"
            mock_settings.s3_bucket = "agentforge"

            from app.storage import download_dataset

            await download_dataset("some/path.csv")

        call_kwargs = mock_client.call_args[1]
        assert call_kwargs.get("endpoint_url") == "http://localhost:9000"

    async def test_no_endpoint_url_when_not_minio(self) -> None:
        """When use_minio=False, boto3.client is NOT called with endpoint_url."""
        mock_response = {"Body": MagicMock(read=MagicMock(return_value=b"data"))}
        mock_s3 = MagicMock()
        mock_s3.get_object.return_value = mock_response

        with (
            patch("boto3.client", return_value=mock_s3) as mock_client,
            patch("app.storage.settings") as mock_settings,
        ):
            mock_settings.use_minio = False
            mock_settings.aws_endpoint_url = None
            mock_settings.aws_access_key_id = "AKID"
            mock_settings.aws_secret_access_key = "SECRET"
            mock_settings.s3_bucket = "prod-bucket"

            from app.storage import download_dataset

            await download_dataset("some/path.csv")

        call_kwargs = mock_client.call_args[1]
        assert "endpoint_url" not in call_kwargs


class TestDownloadSync:
    def test_calls_get_object_with_correct_key(self) -> None:
        """_download_sync calls s3.get_object with the right Bucket and Key."""
        fake_bytes = b"hello"
        mock_s3 = MagicMock()
        mock_s3.get_object.return_value = {"Body": MagicMock(read=MagicMock(return_value=fake_bytes))}

        with (
            patch("boto3.client", return_value=mock_s3),
            patch("app.storage.settings") as mock_settings,
        ):
            mock_settings.use_minio = False
            mock_settings.aws_endpoint_url = None
            mock_settings.aws_access_key_id = "key"
            mock_settings.aws_secret_access_key = "secret"
            mock_settings.s3_bucket = "my-bucket"

            from app.storage import _download_sync

            result = _download_sync("workspaces/ws/data.csv")

        assert result == fake_bytes
        mock_s3.get_object.assert_called_once_with(Bucket="my-bucket", Key="workspaces/ws/data.csv")
