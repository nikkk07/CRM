"""Entry point for the AI CCTV Attendance app.

Runs from any working directory: it switches into its own folder so the
`app` package and the local `data/` directory always resolve correctly
(launchd, the dev previewer, or a plain `python run.py` all work).
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.chdir(HERE)
sys.path.insert(0, str(HERE))

import uvicorn  # noqa: E402

from app import config  # noqa: E402

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=config.PORT, log_level="info")
