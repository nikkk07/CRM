"""One background thread per CCTV camera: reads the RTSP stream, runs face
recognition on a sampled frame, and reports sightings. Auto-reconnects forever."""
import logging
import os
import time
from datetime import datetime
from threading import Lock, Thread

os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
import cv2  # noqa: E402  (env var must be set before import)
import numpy as np  # noqa: E402

from . import config, db, recognition

log = logging.getLogger("camera")

# Live status shown on the dashboard: {camera_name: {...}}
STATUS: dict = {}

# Global lock shared by ALL camera threads so a brand-new face is turned into
# exactly one visitor even if two cameras see it in the same ~1s window.
_visitor_lock = Lock()


class CameraWorker(Thread):
    def __init__(self, cam: dict, recognizer, on_sighting):
        super().__init__(daemon=True, name=f"cam-{cam['name']}")
        self.cam_name = cam["name"]
        self.url = cam["url"]
        self.recognizer = recognizer
        self.on_sighting = on_sighting
        self._last_unknown_save = 0.0
        STATUS[self.cam_name] = {"connected": False, "last_frame": None, "faces_seen": 0}

    def run(self):
        backoff = 2
        while True:
            cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
            if not cap.isOpened():
                STATUS[self.cam_name]["connected"] = False
                log.warning("[%s] cannot connect, retrying in %ss", self.cam_name, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)
                continue
            backoff = 2
            STATUS[self.cam_name]["connected"] = True
            log.info("[%s] connected", self.cam_name)
            next_process = 0.0
            while True:
                ok = cap.grab()  # keep draining the stream so frames never pile up
                if not ok:
                    log.warning("[%s] stream dropped, reconnecting", self.cam_name)
                    break
                now = time.time()
                if now < next_process:
                    continue
                next_process = now + config.PROCESS_EVERY_SEC
                ok, frame = cap.retrieve()
                if not ok or frame is None:
                    continue
                STATUS[self.cam_name]["last_frame"] = datetime.now().strftime("%H:%M:%S")
                try:
                    self._process(frame)
                except Exception:
                    log.exception("[%s] frame processing failed", self.cam_name)
            cap.release()
            STATUS[self.cam_name]["connected"] = False

    def _process(self, frame):
        faces = self.recognizer.detect(frame)
        for face in faces:
            if (face.bbox[3] - face.bbox[1]) < config.MIN_FACE_HEIGHT:
                continue
            pid, score = self.recognizer.match(face.normed_embedding)
            if pid is not None:
                STATUS[self.cam_name]["faces_seen"] += 1
                self.on_sighting(pid, score, self.cam_name, frame, face.bbox)
            elif config.VISITOR_TRACKING:
                self._track_visitor(frame, face, score)
            elif score < config.UNKNOWN_THRESHOLD and face.det_score >= 0.65:
                self._save_unknown(frame, face.bbox)

    def _track_visitor(self, frame, face, score):
        """Turn an unrecognized face into a tracked 'visitor' (role='visitor'),
        reusing the normal attendance pipeline. Falls back to the unknown gallery
        for low-quality faces so junk never becomes a visitor."""
        face_h = face.bbox[3] - face.bbox[1]
        # 1) Quality gate BEFORE creating a visitor.
        if face_h < config.VISITOR_MIN_FACE_PX or face.det_score < config.VISITOR_MIN_DET_SCORE:
            if score < config.UNKNOWN_THRESHOLD and face.det_score >= 0.65:
                self._save_unknown(frame, face.bbox)
            return
        # 2) Dead-zone: only create when clearly new. A score in the ambiguous
        #    band [VISITOR_NEW_THRESHOLD, MATCH_THRESHOLD) is skipped entirely to
        #    avoid splitting one person into many visitors.
        if score >= config.VISITOR_NEW_THRESHOLD:
            return
        embedding = face.normed_embedding
        with _visitor_lock:
            # Double-check under the lock: another camera/frame may have just
            # created this visitor in the last instant.
            pid, score2 = self.recognizer.match(embedding)
            if pid is not None:
                STATUS[self.cam_name]["faces_seen"] += 1
                self.on_sighting(pid, score2, self.cam_name, frame, face.bbox)
                return
            n = db.count_visitors_on(db.today_str()) + 1
            new_pid = db.add_person(name=f"Visitor {n}", role="visitor", crm_id="")
            db.add_face(new_pid, embedding.astype(np.float32).tobytes(), f"visitor:{self.cam_name}")
            # Reload so the very next frame MATCHES this visitor, not re-creates one.
            self.recognizer.reload()
        log.info("[%s] NEW VISITOR 'Visitor %d' (person %s) [best prior score %.2f]",
                 self.cam_name, n, new_pid, score)
        STATUS[self.cam_name]["faces_seen"] += 1
        self.on_sighting(new_pid, score, self.cam_name, frame, face.bbox)

    def _save_unknown(self, frame, bbox):
        """Keep a rate-limited gallery of unrecognized faces so they can be enrolled."""
        now = time.time()
        if now - self._last_unknown_save < 60:
            return
        self._last_unknown_save = now
        crop = recognition.crop_face(frame, bbox)
        if crop is None:
            return
        safe_cam = "".join(ch if ch.isalnum() else "_" for ch in self.cam_name)
        fname = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{safe_cam}.jpg"
        cv2.imwrite(str(config.UNKNOWN_DIR / fname), crop)
        # keep only the newest 200 unknown snapshots
        files = sorted(config.UNKNOWN_DIR.glob("*.jpg"))
        for old in files[:-200]:
            old.unlink(missing_ok=True)
