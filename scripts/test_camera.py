"""Quick camera connection test. Run after filling in .env:
    ./venv/bin/python scripts/test_camera.py
Tries every camera in cameras.yaml and saves one frame from each."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

import cv2
from app import config

cams = config.load_cameras()
if not cams:
    print("❌ No cameras configured. Fill in .env (DVR_HOST/DVR_PASS) and cameras.yaml first.")
    sys.exit(1)

out_dir = config.DATA_DIR / "camera_test"
out_dir.mkdir(exist_ok=True)
ok_count = 0
for cam in cams:
    print(f"Connecting to {cam['name']} ...", end=" ", flush=True)
    cap = cv2.VideoCapture(cam["url"], cv2.CAP_FFMPEG)
    ok, frame = cap.read() if cap.isOpened() else (False, None)
    cap.release()
    if ok and frame is not None:
        path = out_dir / f"{cam['name'].replace(' ', '_')}.jpg"
        cv2.imwrite(str(path), frame)
        print(f"✅ OK  {frame.shape[1]}x{frame.shape[0]}  -> {path}")
        ok_count += 1
    else:
        print("❌ FAILED (check DVR_HOST, DVR_USER, DVR_PASS, channel number)")

print(f"\n{ok_count}/{len(cams)} cameras working.")
