"""Optional snapshot backup to Cloudflare R2 (free tier). Fully async and
non-fatal: if R2 is not configured or offline, the system keeps working."""
import logging
import queue
from threading import Thread

from . import config

log = logging.getLogger("r2")
_queue: "queue.Queue[str]" = queue.Queue(maxsize=1000)


def enabled() -> bool:
    return all([config.R2_ACCOUNT_ID, config.R2_ACCESS_KEY_ID,
                config.R2_SECRET_ACCESS_KEY, config.R2_BUCKET])


def _build_client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=f"https://{config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=config.R2_ACCESS_KEY_ID,
        aws_secret_access_key=config.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


_del_client = None


def delete(rel_path: str):
    """Best-effort removal of a backed-up object; silent if R2 isn't configured."""
    global _del_client
    if not enabled():
        return
    try:
        if _del_client is None:
            _del_client = _build_client()
        _del_client.delete_object(Bucket=config.R2_BUCKET, Key=rel_path)
    except Exception as e:
        log.warning("R2 delete failed for %s: %s", rel_path, e)


def enqueue(rel_path: str):
    """rel_path is relative to the data/ directory."""
    if not enabled():
        return
    try:
        _queue.put_nowait(rel_path)
    except queue.Full:
        pass


class Uploader(Thread):
    def __init__(self):
        super().__init__(daemon=True, name="r2-uploader")
        self.client = _build_client()

    def run(self):
        log.info("R2 backup enabled -> bucket %s", config.R2_BUCKET)
        while True:
            rel = _queue.get()
            path = config.DATA_DIR / rel
            if not path.exists():
                continue
            try:
                self.client.upload_file(str(path), config.R2_BUCKET, rel)
            except Exception as e:
                log.warning("R2 upload failed for %s: %s", rel, e)


def start():
    if enabled():
        Uploader().start()
    else:
        log.info("R2 not configured - snapshots stay local only")
