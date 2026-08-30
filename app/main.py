from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Body, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .itsm_client import ITSMAuthError, ITSMClient, ITSMError
from .notify import TeamsError, build_card, build_digest_card, send_teams, text_card
from .rag.routes import router as rag_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.itsm = ITSMClient()
    try:
        from .rag.migrate import migrate_sqlite_if_needed
        await migrate_sqlite_if_needed()
    except Exception as e:  # noqa: BLE001 - อย่าให้ startup ล้มเพราะ migrate
        print(f"[rag] migrate error: {e}")
    try:
        yield
    finally:
        await app.state.itsm.close()


app = FastAPI(title="ITSM Report API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


app.include_router(rag_router)


@app.get("/services")
async def services():
    return {"services": settings.service_list}


@app.get("/health")
async def health():
    return {"status": "ok"}


def _check_admin(token: str | None):
    if not settings.admin_token:
        raise HTTPException(status_code=503, detail="admin ปิดอยู่ (ตั้ง ITSM_ADMIN_TOKEN)")
    if token != settings.admin_token:
        raise HTTPException(status_code=401, detail="admin token ไม่ถูกต้อง")


@app.get("/admin/itsm-cookie")
async def itsm_cookie_status(request: Request, x_admin_token: str | None = Header(default=None)):
    _check_admin(x_admin_token)
    ok = await request.app.state.itsm.check()
    return {"valid": ok}


@app.post("/admin/itsm-cookie")
async def set_itsm_cookie(
    request: Request,
    cookie: str = Body(..., embed=True, description="ค่า cookie 'itsm' ตัวใหม่"),
    x_admin_token: str | None = Header(default=None),
):
    _check_admin(x_admin_token)
    cookie = cookie.strip()
    if not cookie:
        raise HTTPException(status_code=400, detail="cookie ว่าง")
    client = request.app.state.itsm
    client.set_cookie(cookie)
    if not await client.check():
        raise HTTPException(status_code=400, detail="cookie ใหม่ใช้ไม่ได้ (ITSM ตอบ 401)")
    settings.save_cookie(cookie)          # persist -> รอด container restart
    return {"valid": True, "saved": True}



async def _details(request: Request, value, month, year, support_group) -> dict:
    now = datetime.now()
    payload = {"month": month or now.strftime("%Y-%m"), "year": year or now.strftime("%Y"),
               "column": "service", "value": value}
    sg = settings.support_group if support_group is None else support_group
    try:
        return await request.app.state.itsm.performance_details(payload, sg)
    except ITSMAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except ITSMError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/report/performance/details/{value}")   # alias ให้ตรงกับ path ของ ITSM
async def performance_details(
    request: Request,
    value: str,
    month: str | None = None,
    year: str | None = None,
    support_group: str | None = None,   # None = ใช้ค่า default, "" = ไม่กรอง
):
    return await _details(request, value, month, year, support_group)


def _filter_due(details: list[dict], hours: float | None) -> list[dict]:
    if hours is None:                    # ทุก incident
        return details
    always = settings.always_status_list  # เหลือ < hours ชม. หรือ status ที่แจ้งเสมอ
    return [d for d in details
            if (d["hours_left"] is not None and d["hours_left"] < hours)
            or str(d.get("status", "")).strip().casefold() in always]


@app.post("/notify/teams")
async def notify_teams_all(
    request: Request,
    month: str | None = None,
    year: str | None = None,
    support_group: str | None = None,
    hours: float | None = None,          # ใส่ = กรองเฉพาะงานเหลือ < ชม.นี้ (ไม่ใส่ = ทุกงาน)
    dry_run: bool = False,
    webhook: str | None = None,
):
    """แจ้งเตือนทุก service ใน ITSM_SERVICES — การ์ดเดียว ส่ง webhook ครั้งเดียว."""
    groups: list[tuple[str, list[dict]]] = []
    for svc in settings.service_list:
        data = await _details(request, svc, month, year, support_group)
        due = _filter_due(data["details"], hours)
        if due:
            groups.append((svc, due))

    if not groups:
        return {"sent": False, "reason": "ไม่มีงานเข้าเกณฑ์", "services": settings.service_list}

    payload = build_digest_card(groups, hours)
    if dry_run:
        return {"sent": False, "matched": {s: len(i) for s, i in groups}, "card": payload}
    try:
        await send_teams(payload, webhook or "")
    except TeamsError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"sent": True, "matched": {s: [d["incident_no"] for d in i] for s, i in groups}}


@app.post("/notify/teams/{value}")
async def notify_teams(
    request: Request,
    value: str,
    month: str | None = None,
    year: str | None = None,
    support_group: str | None = None,
    hours: float | None = None,          # ใส่ = กรองเฉพาะงานเหลือ < ชม.นี้ (ไม่ใส่ = ทุกงาน)
    dry_run: bool = False,               # ไม่ส่งจริง คืน card ที่จะส่ง
    webhook: str | None = None,          # override ITSM_TEAMS_WEBHOOK
):
    """ดึงงานของ service เดียว แล้วส่งการ์ดสรุปเข้า MS Teams."""
    data = await _details(request, value, month, year, support_group)
    due = _filter_due(data["details"], hours)
    if not due:
        return {"service": value, "matched": 0, "sent": False, "reason": "ไม่มีงานเข้าเกณฑ์"}
    payload = build_card(value, due, hours)
    if dry_run:
        return {"service": value, "matched": len(due), "sent": False, "card": payload}
    try:
        await send_teams(payload, webhook or "")
    except TeamsError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"service": value, "matched": len(due), "sent": True,
            "incidents": [d["incident_no"] for d in due]}


@app.post("/notify/teams-test")
async def notify_teams_test(text: str = "ทดสอบการเชื่อมต่อ ITSM Monitor ✅",
                            webhook: str | None = None):
    try:
        await send_teams(text_card(text), webhook or "")
    except TeamsError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"sent": True}
