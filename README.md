# We One Aviation — AI CCTV Attendance + CRM

A monorepo with **two apps** that work together.

```
CCTV/                     (git repo → github.com/nikkk07/CRM)
├── attendance/           AI CCTV face-recognition attendance
│                         → runs 24/7 locally on the Mac Mini M4
├── CRM/
│   ├── backend/          FastAPI + Postgres  → deploys to Render
│   ├── frontend/         React + Vite        → deploys to Vercel
│   ├── scripts/          Postgres setup helpers
│   └── docs/             CRM setup notes, local HTTPS Caddyfile
├── render.yaml           Render blueprint (points at CRM/backend)
└── README.md             (this file)
```

| App | Where it runs | URL |
|---|---|---|
| `attendance/` | Mac Mini at the institute | http://localhost:8100 |
| `CRM/frontend` | Vercel | https://crm-three-smoky-26.vercel.app |
| `CRM/backend` | Render | https://crm-weoneaviation.onrender.com |
| Database | Supabase (Postgres) | — |

### How the two apps are linked
- **Login:** the camera dashboard has no separate accounts — you sign in with
  your **CRM login ID & password**, and only the **Admin** department is let in.
  Sales, IT, and Instructors are refused (on both the dashboard and the CRM's
  Attendance tab).
- **Data:** every entry/exit the cameras record is pushed to the CRM
  (`POST /api/attendance/ingest`, protected by a shared token). Admins view it
  in the CRM under the **📷 Attendance** tab.

---

## Part 1 — Attendance system (local, on the Mac Mini)

Watches your existing CP Plus CCTV cameras, recognizes enrolled students &
staff, and marks:
- **Entry** — first sighting on a working day (photo + date + time saved).
- **Exit** — after a person is off **all** cameras for more than 1 hour; the
  exit time recorded is the moment they were **last seen**.
- **Sundays & holidays** are skipped automatically.

Everything runs locally on the M4 — face data never leaves the machine.

### Setup (run these from the `attendance/` folder)

```bash
cd attendance

# 1. Configure the DVR + CRM link
cp .env.example .env
open -e .env          # fill in DVR_HOST, DVR_PASS; CRM fields are pre-filled
open -e cameras.yaml  # name your cameras

# 2. Test the cameras
./.venv/bin/python scripts/test_camera.py     # expect ✅ per camera

# 3. Install the 24/7 service (auto-start on boot, restart on crash)
./scripts/install_service.sh
#    Then: System Settings → Energy → Prevent automatic sleeping = ON
```

4. **Open the dashboard** — http://localhost:8100 on this Mac, or
   `http://<this-mac's-IP>:8100` from any phone on the same WiFi. Sign in with
   your CRM **Admin** account.
5. **Enroll people** — *People* tab → name, role, 2–3 clear face photos each.
   Unrecognized faces collect under *Unknown Faces* for one-click enrollment.

Restart after any `.env` change:
```bash
launchctl unload ~/Library/LaunchAgents/com.weone.attendance.plist
launchctl load   ~/Library/LaunchAgents/com.weone.attendance.plist
```

**Tech:** OpenCV pulls RTSP from the DVR → InsightFace (buffalo_l) identifies
faces locally → SQLite stores people/attendance → FastAPI serves the dashboard
→ launchd keeps it alive. Groq writes the optional daily report (text only);
Cloudflare R2 optionally backs up snapshots.

---

## Part 2 — CRM (goes live on Render + Vercel)

The restructure kept the CRM at `CRM/backend` and `CRM/frontend`, so the deploy
paths below are stable.

### Backend → Render
- **Root Directory:** `CRM/backend`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health check:** `/health`
- **Env vars** (set in the Render dashboard): `DATABASE_URL`, `SECRET_KEY`,
  `ENCRYPTION_KEY`, `ATTENDANCE_INGEST_TOKEN` (must equal `CRM_WEBHOOK_TOKEN` in
  `attendance/.env`), plus optional `GROQ_API_KEY`, `MONGODB_ATLAS_URI`, `R2_*`.

These are encoded in [`render.yaml`](render.yaml) — connect it as a Blueprint,
or copy the settings manually.

### Frontend → Vercel
- **Root Directory:** `CRM/frontend`
- **Framework:** Vite (auto-detected; also pinned in `CRM/frontend/vercel.json`)
- **Build:** `npm run build` · **Output:** `dist`
- **Env var:** `VITE_API_URL` = your Render backend URL
  (e.g. `https://crm-weoneaviation.onrender.com`)

### First-time deploy checklist
1. `git push -u origin main` (repo → `nikkk07/CRM`).
2. Render: set Root Directory to `CRM/backend`; add the env vars above.
3. Vercel: set Root Directory to `CRM/frontend`; add `VITE_API_URL`.
4. Delete the old, accidental `nikkk07/CCTV` repo (it still holds a leaked venv).

---

## Important notes
- **Consent:** the attendance system stores biometric (face) data. Collect a
  written consent form from every student & staff member (India's DPDP Act).
- Secrets live only in `.env` files, which are git-ignored. Never commit them.
- Attendance recognition strictness and the 1-hour exit window are tunable in
  `attendance/.env`.
