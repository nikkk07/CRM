# We One Aviation — CRM

A React + FastAPI CRM. Attendance is captured by a **Hikvision DS-K1T320EFWX
biometric (fingerprint/face) terminal** at the institute, which pushes punches
directly to the backend — there is no local camera app to run.

```
CCTV/                     (git repo → github.com/nikkk07/CRM)
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
| `CRM/frontend` | Vercel | https://crm-three-smoky-26.vercel.app |
| `CRM/backend` | Render | https://crm-weoneaviation.onrender.com |
| Database | Supabase (Postgres) | — |

### Attendance

The Hikvision biometric terminal is configured (in its **HTTP Listening**
settings) to POST each successful authentication event to:

```
POST /api/attendance/hikvision?token=<ATTENDANCE_INGEST_TOKEN>
```

The backend records entry/exit into the `cctv_attendance` table (kept under that
name for historical continuity). Admins view it in the CRM under the
**Attendance** tab — only the **Admin** department is allowed in.

> The older `POST /api/attendance/ingest` endpoint remains in place (token
> protected, currently unused) so a camera-based feed could be re-enabled later
> without a schema change.

---

## CRM deploy (Render + Vercel)

The CRM lives at `CRM/backend` and `CRM/frontend`, so the deploy paths below are
stable.

### Backend → Render
- **Root Directory:** `CRM/backend`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health check:** `/health`
- **Env vars** (set in the Render dashboard): `DATABASE_URL`, `SECRET_KEY`,
  `ENCRYPTION_KEY`, `ATTENDANCE_INGEST_TOKEN` (the shared secret the biometric
  terminal sends as `?token=`), plus optional `GROQ_API_KEY`,
  `MONGODB_ATLAS_URI`, `R2_*`.

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

---

## Important notes
- **Consent:** the biometric terminal stores fingerprint/face data. Collect a
  written consent form from every student & staff member (India's DPDP Act).
- Secrets live only in `.env` files, which are git-ignored. Never commit them.
