"""7-day biometric retention purge for visitors.

Visitors (people rows with role='visitor') keep their FULL attendance log
forever — times + the anonymized "Visitor N" label, which is NOT biometric.
Their BIOMETRIC data (face embeddings + face image files) is deleted after
VISITOR_RETENTION_DAYS so we never retain a stranger's face beyond the window.
"""
import logging
from datetime import datetime, timedelta

from . import config, db, r2

log = logging.getLogger("purge")


def purge_expired_visitors(recognizer=None) -> int:
    """Delete biometrics for visitors older than the retention window.
    Keeps the attendance rows (non-biometric log). Returns count purged."""
    cutoff_iso = (datetime.now() - timedelta(days=config.VISITOR_RETENTION_DAYS)) \
        .isoformat(timespec="seconds")
    victims = db.expired_visitors(cutoff_iso)
    if not victims:
        return 0

    files_deleted = 0
    for v in victims:
        pid = v["id"]
        # 1) Delete face-image files from disk (attendance snapshots, last_seen,
        #    enrolled photo) — best-effort, and mirror the delete to R2 if on.
        for rel in db.visitor_snapshot_paths(pid):
            p = config.DATA_DIR / rel
            try:
                p.unlink(missing_ok=True)
                files_deleted += 1
            except OSError:
                pass
            r2.delete(rel)
        # 2) Any per-person crop folder (people/<pid>/...).
        pdir = config.PEOPLE_DIR / str(pid)
        if pdir.exists():
            for f in pdir.glob("*"):
                f.unlink(missing_ok=True)
            try:
                pdir.rmdir()
            except OSError:
                pass
        # 3) Delete embeddings + last_seen, keep the anonymized attendance log.
        db.purge_visitor_biometrics(pid)

    # 4) Drop the deleted embeddings from the in-memory recognizer.
    if recognizer is not None:
        recognizer.reload()

    log.info("Visitor purge: removed biometrics for %d visitor(s), %d image file(s) "
             "(retention %d days) — anonymized attendance log retained",
             len(victims), files_deleted, config.VISITOR_RETENTION_DAYS)
    return len(victims)
