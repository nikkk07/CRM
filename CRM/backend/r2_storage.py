"""Cloudflare R2 (S3-compatible) storage. Private bucket only — downloads via short-lived presigned URLs.
Credentials come from env; nothing is hardcoded. boto3 is imported lazily so the app boots without it."""
import os
import uuid

_client = None


def _r2():
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config
        account = os.getenv("R2_ACCOUNT_ID")
        if not account:
            raise RuntimeError("R2 not configured (R2_ACCOUNT_ID missing)")
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
            aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
    return _client


def _bucket():
    b = os.getenv("R2_BUCKET")
    if not b:
        raise RuntimeError("R2 not configured (R2_BUCKET missing)")
    return b


def build_key(student_id: str, doc_type: str, ext: str) -> str:
    return f"students/{student_id}/{doc_type}/{uuid.uuid4().hex}.{ext}"


def upload_bytes(key: str, data: bytes, content_type: str):
    _r2().put_object(Bucket=_bucket(), Key=key, Body=data, ContentType=content_type)


def presigned_get(key: str, expires: int = 300) -> str:
    # expires capped at 5 minutes per policy for government ID documents
    return _r2().generate_presigned_url(
        "get_object", Params={"Bucket": _bucket(), "Key": key}, ExpiresIn=min(expires, 300)
    )


def delete_object(key: str):
    _r2().delete_object(Bucket=_bucket(), Key=key)


def list_keys(prefix: str) -> list:
    """All object keys under a prefix (paginated). Used to catch strays before a hard delete."""
    keys = []
    token = None
    while True:
        kwargs = {"Bucket": _bucket(), "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        resp = _r2().list_objects_v2(**kwargs)
        keys.extend(obj["Key"] for obj in resp.get("Contents", []))
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
    return keys
