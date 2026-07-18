"""Face detection + identification. Runs 100% locally on the Mac (InsightFace buffalo_l).

One shared model instance guarded by a lock — at ~1 frame/sec per camera the
M4 handles 4 cameras easily.
"""
import logging
import threading

import numpy as np

from . import config, db

log = logging.getLogger("recognition")


class Recognizer:
    def __init__(self):
        from insightface.app import FaceAnalysis  # heavy import, keep local

        self._lock = threading.Lock()
        self.app = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection", "recognition"],
            providers=["CPUExecutionProvider"],
        )
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        self._matrix = np.zeros((0, 512), dtype=np.float32)
        self._person_ids: list[int] = []
        self.reload()
        log.info("Face model ready (%d enrolled embeddings)", len(self._person_ids))

    def reload(self):
        """Re-read all enrolled face embeddings from the database."""
        rows = db.all_faces()
        ids, vecs = [], []
        for r in rows:
            v = np.frombuffer(r["embedding"], dtype=np.float32)
            if v.shape[0] != 512:
                continue
            n = np.linalg.norm(v)
            if n == 0:
                continue
            vecs.append(v / n)
            ids.append(r["person_id"])
        with self._lock:
            self._person_ids = ids
            self._matrix = np.vstack(vecs) if vecs else np.zeros((0, 512), dtype=np.float32)

    def detect(self, frame_bgr):
        """Return list of insightface Face objects (bbox, det_score, normed_embedding)."""
        with self._lock:
            return self.app.get(frame_bgr)

    def match(self, normed_embedding):
        """Return (person_id, score) for the best match, or (None, best_score)."""
        with self._lock:
            if self._matrix.shape[0] == 0:
                return None, 0.0
            sims = self._matrix @ normed_embedding.astype(np.float32)
            idx = int(np.argmax(sims))
            score = float(sims[idx])
            pid = self._person_ids[idx]
        if score >= config.MATCH_THRESHOLD:
            return pid, score
        return None, score

    def embed_image(self, image_bgr):
        """For enrollment photos: return (embedding_bytes, face) of the largest face, or (None, None)."""
        faces = self.detect(image_bgr)
        if not faces:
            return None, None
        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        emb = face.normed_embedding.astype(np.float32)
        return emb.tobytes(), face


def crop_face(frame, bbox, margin=0.4):
    """Crop a face from the frame with some margin around the bounding box."""
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = [float(v) for v in bbox]
    mw, mh = (x2 - x1) * margin, (y2 - y1) * margin
    x1, y1 = max(0, int(x1 - mw)), max(0, int(y1 - mh))
    x2, y2 = min(w, int(x2 + mw)), min(h, int(y2 + mh))
    if x2 <= x1 or y2 <= y1:
        return None
    return frame[y1:y2, x1:x2]
