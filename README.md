# We One Aviation — AI CCTV Attendance + CRM

This repo holds **two linked apps**:

| App | Where it runs | URL |
|---|---|---|
| AI CCTV Attendance (this folder) | Mac Mini at the institute | http://localhost:8100 |
| CRM (`CRM/` folder) | Vercel (frontend) + Render (backend) + Supabase (DB) | https://crm-three-smoky-26.vercel.app |

**How they're linked**
- Signing in to the camera dashboard uses your **CRM login ID & password** —
  and only the **Admin** department is allowed in. Sales, IT, and Instructors
  are refused, on both the camera dashboard and the CRM's Attendance tab.
- Every entry/exit the cameras record is pushed automatically to the CRM
  (`POST /api/attendance/ingest`, protected by a shared secret token), and
  Admins see it in the CRM under the **📷 Attendance** tab.

**After pushing this repo, do once:**
1. On **Render** (crm-weoneaviation): set root directory to `CRM/backend`,
   and add env var `ATTENDANCE_INGEST_TOKEN` = the value in `CRM/backend/.env`.
2. On **Vercel**: set the project root directory to `CRM/frontend`.


Fully-free, 24/7 attendance system that watches your existing CP Plus CCTV
cameras, recognizes enrolled students & staff, and automatically marks:

- **Entry** — first time a person is seen on any camera on a working day
  (photo + date + time is saved).
- **Exit** — when a person has been off **all** cameras for more than 1 hour;
  the exit time recorded is the moment they were **last seen**.
- **Sundays and holidays** are skipped automatically.

Everything runs locally on this Mac Mini. Face data never leaves the machine.

## One-time setup

1. **Configure the DVR connection**
   ```
   cp .env.example .env
   open -e .env        # fill in DVR_HOST and DVR_PASS
   ```
   Find the DVR's IP and password in the DVR menu (Main Menu → Network) or
   your CP Plus mobile app. Edit `cameras.yaml` to name your cameras.

2. **Test the cameras**
   ```
   ./venv/bin/python scripts/test_camera.py
   ```
   You should see ✅ for each camera, with a saved test frame in `data/camera_test/`.

3. **Install the 24/7 service** (auto-starts on boot, restarts if it crashes)
   ```
   ./scripts/install_service.sh
   ```
   Then set **System Settings → Energy → Prevent automatic sleeping … = ON**
   so the Mac never sleeps.

4. **Open the dashboard** — http://localhost:8100 on this Mac, or
   `http://<this-mac's-IP>:8100` from any phone/laptop on the same WiFi.
   Sign in with your CRM Admin account.

5. **Enroll people** — dashboard → *People* → add name, role, and 2–3 clear
   face photos each. Anyone the cameras see who isn't enrolled appears under
   *Unknown Faces*, where you can enroll them in one click.

## Optional (all free)

| Feature | How to enable |
|---|---|
| Daily AI summary report | Put your `GROQ_API_KEY` in `.env` |
| Off-site snapshot backup | Create a free R2 bucket, fill `R2_*` in `.env` |
| CRM auto-sync | Set `CRM_WEBHOOK_URL` in `.env` — every entry/exit is POSTed as JSON |
| CRM manual import | Dashboard → History → **Excel export** |

Restart the service after any `.env` change:
```
launchctl unload ~/Library/LaunchAgents/com.weone.attendance.plist
launchctl load   ~/Library/LaunchAgents/com.weone.attendance.plist
```

## Important notes

- **Consent**: this system stores biometric (face) data. Collect a simple
  written consent form from every student and staff member (required under
  India's DPDP Act).
- The dashboard has no password and is reachable by anyone on your WiFi —
  keep the WiFi password private.
- Recognition strictness, exit window, etc. are tunable in `.env`.

## How it works (tech)

Python + OpenCV pulls RTSP streams from the DVR → InsightFace (buffalo_l)
detects & identifies faces locally on the M4 → SQLite stores people,
embeddings, and attendance → FastAPI serves the dashboard → launchd keeps it
running 24/7. Groq (text only) writes the daily report; Cloudflare R2 backs
up snapshots; a webhook pushes attendance to your CRM.
