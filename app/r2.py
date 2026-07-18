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
        import boto3
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=config.R2_ACCESS_KEY_ID,
            aws_secret_access_key=config.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )

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
