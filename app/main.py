"""We One Aviation — AI CCTV Attendance. FastAPI app + background workers."""
import io
import logging
from datetime import datetime, timedelta
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, Form, Request, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import attendance, auth, camera, config, crm, db, r2, reports

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(config.LOG_DIR / "app.log"),
    ],
)
log = logging.getLogger("main")

app = FastAPI(title="We One Aviation Attendance")
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))
app.mount("/static", StaticFiles(directory=str(Path(__file__).parent / "static")), name="static")
# serve only image folders — never the database or logs
app.mount("/data/snapshots", StaticFiles(directory=str(config.SNAP_DIR)), name="snapshots")
app.mount("/data/unknowns", StaticFiles(directory=str(config.UNKNOWN_DIR)), name="unknowns")
app.mount("/data/people", StaticFiles(directory=str(config.PEOPLE_DIR)), name="people")

RECOGNIZER = None

# Paths reachable without an Admin session
_PUBLIC = ("/login", "/health", "/static/", "/favicon.ico")


@app.middleware("http")
async def admin_only(request: Request, call_next):
    """Camera monitoring is restricted to CRM 'Admin' department members.

    Guards every page, API route, and snapshot image — including the
    mounted static image folders, which route dependencies can't cover.
    """
    path = request.url.path
    if path == "/login" or any(path.startswith(p) for p in _PUBLIC):
        return await call_next(request)
    session = auth.read_session(request.cookies.get(auth.COOKIE_NAME, ""))
    if session is None:
        if path.startswith("/api") or path.startswith("/data"):
            return JSONResponse({"detail": "Admin login required"}, status_code=401)
        return RedirectResponse("/login", status_code=303)
    request.state.user = session
    return await call_next(request)


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if auth.read_session(request.cookies.get(auth.COOKIE_NAME, "")):
        return RedirectResponse("/", status_code=303)
    return templates.TemplateResponse(request, "login.html", {"request": request, "error": ""})


@app.post("/login", response_class=HTMLResponse)
def login_submit(request: Request, login_id: str = Form(...), password: str = Form(...)):
    employee, error = auth.crm_login(login_id, password)
    if error:
        return templates.TemplateResponse(request, "login.html",
                                          {"request": request, "error": error})
    dept = (employee.get("department") or "").strip()
    if dept != "Admin":
        log.warning("Camera access DENIED for %s (department: %s)",
                    employee.get("name"), dept or "none")
        return templates.TemplateResponse(request, "login.html", {
            "request": request,
            "error": f"Access denied. Camera monitoring is for the Admin "
                     f"department only — your CRM account is in "
                     f"'{dept or 'no'}' department.",
        })
    log.info("Admin login: %s", employee.get("name"))
    resp = RedirectResponse("/", status_code=303)
    resp.set_cookie(auth.COOKIE_NAME, auth.make_session(employee),
                    max_age=auth.SESSION_HOURS * 3600, httponly=True, samesite="lax")
    return resp


@app.get("/logout")
def logout():
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(auth.COOKIE_NAME)
    return resp


@app.on_event("startup")
def startup():
    global RECOGNIZER
    db.init()
    from .recognition import Recognizer
    RECOGNIZER = Recognizer()
    cams = config.load_cameras()
    if not cams:
        log.warning("No cameras configured yet - fill .env and cameras.yaml")
    for cam in cams:
        camera.CameraWorker(cam, RECOGNIZER, attendance.record_sighting).start()
    attendance.ExitChecker().start()
    r2.start()
    crm.start()
    reports.start()
    log.info("Startup complete: %d cameras", len(cams))


def ctx(request: Request, **kw):
    base = {
        "request": request,
        "today": db.today_str(),
        "cameras": camera.STATUS,
        "cameras_configured": bool(config.load_cameras()),
    }
    base.update(kw)
    return base


# ---------------- dashboard ----------------

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    today = db.today_str()
    rows = db.day_rows(today)
    people = db.list_people(active_only=True)
    present_ids = {r["person_id"] for r in rows}
    absent = [p for p in people if p["id"] not in present_ids]
    inside = [r for r in rows if r["exit_time"] is None]
    now = datetime.now()
    working = attendance.is_working_day(now)
    report = db.get_report(today)
    return templates.TemplateResponse(request, "index.html", ctx(
        request, rows=rows, absent=absent, inside_count=len(inside),
        total_people=len(people), working_day=working, report=report,
    ))


# ---------------- people & enrollment ----------------

@app.get("/people", response_class=HTMLResponse)
def people_page(request: Request, msg: str = "", err: str = ""):
    return templates.TemplateResponse(request, "people.html", ctx(
        request, people=db.list_people(), msg=msg, err=err,
    ))


def _decode_upload(data: bytes):
    arr = np.frombuffer(data, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def _enroll_photo(pid: int, img, source: str) -> bool:
    emb, face = RECOGNIZER.embed_image(img)
    if emb is None:
        return False
    db.add_face(pid, emb, source)
    person_dir = config.PEOPLE_DIR / str(pid)
    person_dir.mkdir(exist_ok=True)
    from .recognition import crop_face
    crop = crop_face(img, face.bbox)
    photo_path = person_dir / f"{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.jpg"
    cv2.imwrite(str(photo_path), crop if crop is not None else img)
    person = db.get_person(pid)
    if person and not person["photo"]:
        db.update_person(pid, photo=str(photo_path.relative_to(config.DATA_DIR)))
    RECOGNIZER.reload()
    return True


@app.post("/people/add")
async def people_add(name: str = Form(...), role: str = Form("student"),
                     crm_id: str = Form(""), photos: list[UploadFile] = File(default=[])):
    pid = db.add_person(name, role, crm_id)
    enrolled = 0
    for up in photos:
        data = await up.read()
        if not data:
            continue
        img = _decode_upload(data)
        if img is not None and _enroll_photo(pid, img, up.filename or "upload"):
            enrolled += 1
    if enrolled == 0 and photos:
        return RedirectResponse(
            f"/people?err=Added {name}, but no clear face was found in the photo(s). "
            "Upload a sharper, front-facing photo.", status_code=303)
    return RedirectResponse(f"/people?msg={name} added with {enrolled} face photo(s).", status_code=303)


@app.post("/people/{pid}/photo")
async def people_add_photo(pid: int, photos: list[UploadFile] = File(default=[])):
    enrolled = 0
    for up in photos:
        data = await up.read()
        img = _decode_upload(data) if data else None
        if img is not None and _enroll_photo(pid, img, up.filename or "upload"):
            enrolled += 1
    msg = f"{enrolled} photo(s) enrolled." if enrolled else ""
    err = "" if enrolled else "No clear face found in the photo(s)."
    return RedirectResponse(f"/people?msg={msg}&err={err}", status_code=303)


@app.post("/people/{pid}/toggle")
def people_toggle(pid: int):
    p = db.get_person(pid)
    if p:
        db.update_person(pid, active=0 if p["active"] else 1)
        RECOGNIZER.reload()
    return RedirectResponse("/people", status_code=303)


@app.post("/people/{pid}/delete")
def people_delete(pid: int):
    db.delete_person(pid)
    RECOGNIZER.reload()
    return RedirectResponse("/people?msg=Person deleted.", status_code=303)


# ---------------- unknown faces ----------------

@app.get("/unknowns", response_class=HTMLResponse)
def unknowns_page(request: Request):
    files = sorted(config.UNKNOWN_DIR.glob("*.jpg"), reverse=True)[:60]
    items = [f.name for f in files]
    return templates.TemplateResponse(request, "unknowns.html", ctx(
        request, items=items, people=db.list_people(active_only=True),
    ))


@app.post("/unknowns/enroll")
def unknowns_enroll(filename: str = Form(...), person_id: str = Form(""),
                    new_name: str = Form(""), new_role: str = Form("student")):
    path = config.UNKNOWN_DIR / Path(filename).name
    if not path.exists():
        return RedirectResponse("/unknowns", status_code=303)
    img = cv2.imread(str(path))
    if person_id:
        pid = int(person_id)
    elif new_name.strip():
        pid = db.add_person(new_name, new_role)
    else:
        return RedirectResponse("/unknowns", status_code=303)
    if img is not None and _enroll_photo(pid, img, f"unknown:{filename}"):
        path.unlink(missing_ok=True)
    return RedirectResponse("/unknowns", status_code=303)


@app.post("/unknowns/clear")
def unknowns_clear():
    for f in config.UNKNOWN_DIR.glob("*.jpg"):
        f.unlink(missing_ok=True)
    return RedirectResponse("/unknowns", status_code=303)


# ---------------- history & export ----------------

@app.get("/history", response_class=HTMLResponse)
def history_page(request: Request, date_from: str = "", date_to: str = "", person: str = ""):
    today = db.today_str()
    date_from = date_from or (datetime.now() - timedelta(days=6)).strftime("%Y-%m-%d")
    date_to = date_to or today
    pid = int(person) if person.isdigit() else None
    rows = db.history_rows(date_from, date_to, pid)
    return templates.TemplateResponse(request, "history.html", ctx(
        request, rows=rows, date_from=date_from, date_to=date_to,
        person=person, people=db.list_people(),
    ))


@app.get("/export.xlsx")
def export_xlsx(date_from: str = "", date_to: str = "", person: str = ""):
    from openpyxl import Workbook
    today = db.today_str()
    date_from = date_from or (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    date_to = date_to or today
    pid = int(person) if person.isdigit() else None
    rows = db.history_rows(date_from, date_to, pid)
    wb = Workbook()
    ws = wb.active
    ws.title = "Attendance"
    ws.append(["Date", "Name", "Role", "CRM ID", "Entry Time", "Exit Time", "Hours"])
    for r in rows:
        hours = ""
        if r["entry_time"] and r["exit_time"]:
            t1 = datetime.strptime(r["entry_time"], "%H:%M:%S")
            t2 = datetime.strptime(r["exit_time"], "%H:%M:%S")
            if t2 > t1:
                hours = round((t2 - t1).total_seconds() / 3600, 2)
        ws.append([r["date"], r["name"], r["role"], r["crm_id"],
                   r["entry_time"], r["exit_time"] or "", hours])
    for col, width in zip("ABCDEFG", (12, 26, 10, 14, 12, 12, 8)):
        ws.column_dimensions[col].width = width
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"attendance_{date_from}_to_{date_to}.xlsx"
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------------- reports & settings ----------------

@app.post("/report/generate")
def report_generate():
    reports.generate(db.today_str())
    return RedirectResponse("/", status_code=303)


@app.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request):
    return templates.TemplateResponse(request, "settings.html", ctx(
        request, holidays=db.list_holidays(),
        exit_minutes=config.EXIT_AFTER_MINUTES,
        threshold=config.MATCH_THRESHOLD,
        groq=bool(config.GROQ_API_KEY), r2=r2.enabled(), crm=crm.enabled(),
    ))


@app.post("/holidays/add")
def holidays_add(date: str = Form(...), name: str = Form("Holiday")):
    db.add_holiday(date, name)
    return RedirectResponse("/settings", status_code=303)


@app.post("/holidays/delete")
def holidays_delete(date: str = Form(...)):
    db.delete_holiday(date)
    return RedirectResponse("/settings", status_code=303)


@app.get("/health")
def health():
    return {"ok": True, "cameras": camera.STATUS}
