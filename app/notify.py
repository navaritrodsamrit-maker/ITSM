import httpx

from .config import settings

_COLOR = {"overdue": "attention", "critical": "attention",
          "warning": "warning", "ok": "good", "unknown": "default"}
_LABEL = {"overdue": "เลยกำหนด", "critical": "วิกฤต", "warning": "ใกล้ครบกำหนด",
          "ok": "ปกติ", "unknown": "ไม่ทราบ"}


class TeamsError(Exception):
    pass


def _left_text(d: dict) -> str:
    h = d.get("hours_left")
    if h is None:
        return "ไม่ทราบ"
    if h < 0:
        return f"เลยกำหนด {abs(h):.1f} ชม."
    return f"เหลือ {h:.1f} ชม."


def _count_text(n: int, limit: float | None) -> str:
    return f"{n} งานทั้งหมด" if limit is None else f"{n} งานใกล้/เลยกำหนด (< {limit:g} ชม.)"


def _row(d: dict) -> dict:
    return {
        "type": "ColumnSet",
        "separator": True,
        "columns": [
            {"type": "Column", "width": "auto", "items": [
                {"type": "TextBlock", "text": d.get("priority_level", "-"),
                 "weight": "Bolder", "color": _COLOR.get(d["urgency"], "default")}]},
            {"type": "Column", "width": "stretch", "items": [
                {"type": "TextBlock",
                 "text": f"[{d.get('incident_no', '-')}]({d.get('itsm_url') or settings.base_url})",
                 "weight": "Bolder"},
                {"type": "TextBlock", "text": d.get("problemtopic", ""), "wrap": True,
                 "spacing": "None", "isSubtle": True},
                {"type": "TextBlock",
                 "text": f"{d.get('status', '-')} · {_left_text(d)} · deadline "
                         f"{d.get('deadline', '-')} · {d.get('to_support_name', '-')}",
                 "wrap": True, "spacing": "None", "size": "Small", "isSubtle": True}]},
        ],
    }


def build_card(service: str, incidents: list[dict], limit: float | None = None) -> dict:
    worst = incidents[0]["urgency"] if incidents else "ok"
    card = {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.4",
        "body": [
            {"type": "TextBlock", "text": f"⚠️ ITSM: {service}", "size": "Large",
             "weight": "Bolder", "color": _COLOR.get(worst, "default")},
            {"type": "TextBlock", "text": _count_text(len(incidents), limit),
             "isSubtle": True, "spacing": "None"},
            *[_row(d) for d in incidents],
        ],
    }
    return wrap(card)


def build_digest_card(groups: list[tuple[str, list[dict]]], limit: float | None = None) -> dict:
    """การ์ดเดียว รวมหลาย service (ส่ง webhook ครั้งเดียว = 1 flow run)."""
    total = sum(len(inc) for _, inc in groups)
    body: list[dict] = [
        {"type": "TextBlock", "text": "⚠️ ITSM Monitor", "size": "Large", "weight": "Bolder"},
        {"type": "TextBlock", "text": f"{total} งาน · {len(groups)} service",
         "isSubtle": True, "spacing": "None"},
    ]
    for service, incidents in groups:
        worst = incidents[0]["urgency"] if incidents else "ok"
        body.append({"type": "TextBlock", "text": f"— {service} ({_count_text(len(incidents), limit)})",
                     "weight": "Bolder", "size": "Medium", "separator": True,
                     "color": _COLOR.get(worst, "default"), "spacing": "Medium"})
        body.extend(_row(d) for d in incidents)
    return wrap({
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.4",
        "body": body,
    })


def wrap(card: dict) -> dict:
    return {"type": "message",
            "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive", "content": card}]}


def text_card(text: str) -> dict:
    return wrap({
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.4",
        "body": [{"type": "TextBlock", "text": text, "wrap": True}],
    })


async def send_teams(payload: dict, webhook: str = "") -> None:
    url = webhook or settings.teams_webhook
    if not url:
        raise TeamsError("ยังไม่ได้ตั้ง ITSM_TEAMS_WEBHOOK")
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(url, json=payload)
    except httpx.RequestError as e:
        raise TeamsError(f"ส่ง Teams ไม่ได้: {e}") from e
    if r.status_code >= 300:
        raise TeamsError(f"Teams webhook ตอบ {r.status_code}: {r.text[:200]}")
