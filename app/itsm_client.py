import re
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from .config import settings

_TZ = ZoneInfo(settings.tz)
_SUBFORM = re.compile(r"-\d+$")   # เลข inc ลงท้าย -1, -2, ... = sub-form


def itsm_url(incident_no: str, ident) -> str | None:
    if not ident:
        return None
    path = ("incidents/sub-form/form" if _SUBFORM.search(str(incident_no or ""))
            else "incidents/request/main-incident")
    return f"{settings.base_url}/{path}?id={ident}"


def hours_left(deadline: str) -> float | None:
    """แปลง deadline "DD/MM/YYYY HH:mm" -> จำนวนชั่วโมงจากนี้ (ติดลบ = เลยกำหนด)."""
    try:
        dl = datetime.strptime(deadline.strip(), "%d/%m/%Y %H:%M").replace(tzinfo=_TZ)
    except (ValueError, AttributeError):
        return None
    return round((dl - datetime.now(_TZ)).total_seconds() / 3600, 1)


def _urgency(h: float | None, late: str) -> str:
    if late.strip() or (h is not None and h < 0):
        return "overdue"
    if h is None:
        return "unknown"
    if h < 8:
        return "critical"
    if h < 24:
        return "warning"
    return "ok"


class ITSMError(Exception):
    """ITSM ตอบกลับแต่ไม่สำเร็จ (success=false / 5xx / JSON เพี้ยน)."""


class ITSMAuthError(ITSMError):
    """cookie 'itsm' หมดอายุหรือไม่ถูกต้อง (401/403)."""


# ต้องเหมือน browser จริง ไม่งั้น CloudFront WAF บล็อก 403
_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Origin": settings.base_url,
    "Referer": settings.base_url + "/",
    "sec-ch-ua": '"Chromium";v="126", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}
class ITSMClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.base_url,
            headers=_HEADERS,
            cookies={"itsm": settings.current_cookie()},
            timeout=settings.timeout,
        )
    async def close(self) -> None:
        await self._client.aclose()
    def set_cookie(self, value: str) -> None:
        self._client.cookies = httpx.Cookies({"itsm": value.strip()})
    async def check(self) -> bool:
        """ยิงเบา ๆ เช็คว่า cookie ยังใช้ได้ไหม."""
        try:
            await self.performance_details(
                {"month": "2000-01", "year": "2000", "column": "service", "value": "_healthcheck_"}
            )
            return True
        except ITSMAuthError:
            return False
        except ITSMError:
            return True   # ตอบกลับมาแล้ว (แค่ไม่มีข้อมูล) = cookie ใช้ได้
    async def performance_details(self, payload: dict, support_group: str = "") -> dict:
        try:
            r = await self._client.post("/api/report/performance/details", json=payload)
        except httpx.RequestError as e:
            raise ITSMError(f"เชื่อมต่อ ITSM ไม่ได้: {e}") from e

        if r.status_code in (401, 403):
            raise ITSMAuthError("cookie 'itsm' หมดอายุหรือไม่ถูกต้อง")
        if r.status_code >= 500:
            raise ITSMError(f"ITSM ตอบ {r.status_code}")

        try:
            body = r.json()
        except ValueError as e:
            raise ITSMError("ITSM ไม่ได้ตอบเป็น JSON") from e
        if not body.get("success", False):
            raise ITSMError(body.get("message") or "ITSM returned success=false")

        data = body.get("data") or {}
        details = data.get("details") or []
        if support_group:
            want = support_group.strip().casefold()
            details = [d for d in details
                       if str(d.get("support_group", "")).strip().casefold() == want]
        for d in details:
            h = hours_left(str(d.get("deadline", "")))
            d["hours_left"] = h
            d["urgency"] = _urgency(h, str(d.get("lateStatus", "")))
            d["itsm_url"] = itsm_url(d.get("incident_no"), d.get("id"))
        details.sort(key=lambda d: (d["hours_left"] is None, d["hours_left"] or 0))
        return {"columns": data.get("columns") or [], "details": details, "count": len(details)}
