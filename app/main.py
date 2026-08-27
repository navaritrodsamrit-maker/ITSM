from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .itsm_client import ITSMAuthError, ITSMClient, ITSMError
from .notify import TeamsError, build_card, send_teams, text_card


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.itsm = ITSMClient()
    try:
        yield
    finally:
        await app.state.itsm.close()


app = FastAPI(title="ITSM Report API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/services")
async def services():
    return {"services": settings.service_list}


@app.get("/health")
async def health():
    return {"status": "ok"}



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


async def _alert_one(request, service, month, year, support_group, hours, dry_run, webhook):
    data = await _details(request, service, month, year, support_group)
    always = settings.always_status_list
    if hours is None:                    # default = ทุก incident ของ service
        due = data["details"]
    else:                                # กรองเฉพาะที่เหลือ < hours ชม. (+ status ที่แจ้งเสมอ)
        due = [d for d in data["details"]
               if (d["hours_left"] is not None and d["hours_left"] < hours)
               or str(d.get("status", "")).strip().casefold() in always]
    if not due:
        return {"service": service, "matched": 0, "sent": False, "reason": "ไม่มีงานเข้าเกณฑ์"}
    payload = build_card(service, due, hours)
    if dry_run:
        return {"service": service, "matched": len(due), "sent": False, "card": payload}
    try:
        await send_teams(payload, webhook or "")
    except TeamsError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"service": service, "matched": len(due), "sent": True,
            "incidents": [d["incident_no"] for d in due]}


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
    """แจ้งเตือนทุก service ใน ITSM_SERVICES (Store Retention Management, Human Resource Management, ...)."""
    results = [await _alert_one(request, svc, month, year, support_group, hours, dry_run, webhook)
               for svc in settings.service_list]
    return {"services": settings.service_list, "results": results}


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
    return await _alert_one(request, value, month, year, support_group, hours, dry_run, webhook)


@app.post("/notify/teams-test")
async def notify_teams_test(text: str = "ทดสอบการเชื่อมต่อ ITSM Monitor ✅",
                            webhook: str | None = None):
    try:
        await send_teams(text_card(text), webhook or "")
    except TeamsError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"sent": True}
