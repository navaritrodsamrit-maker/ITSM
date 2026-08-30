"""ดึงข้อความจากไฟล์ประเภทต่าง ๆ."""
import csv
import io

from fastapi import HTTPException


def _pdf(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return "\n\n".join((p.extract_text() or "") for p in reader.pages)


def _pptx(data: bytes) -> str:
    from pptx import Presentation
    prs = Presentation(io.BytesIO(data))
    out = []
    for i, slide in enumerate(prs.slides, 1):
        parts = [f"[สไลด์ {i}]"]
        for shape in slide.shapes:
            if shape.has_text_frame:
                parts.append(shape.text_frame.text)
            if shape.has_table:
                for row in shape.table.rows:
                    parts.append(" | ".join(c.text for c in row.cells))
        out.append("\n".join(p for p in parts if p.strip()))
    return "\n\n".join(out)


def _text(data: bytes) -> str:
    for enc in ("utf-8", "utf-8-sig", "cp874", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def extract(filename: str, data: bytes) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    try:
        if ext == "pdf":
            return _pdf(data)
        if ext in ("pptx", "ppt"):
            return _pptx(data)
        if ext in ("txt", "md", "text"):
            return _text(data)
    except Exception as e:  # noqa: BLE001 - ห่อ error ให้ผู้ใช้เข้าใจ
        raise HTTPException(status_code=400, detail=f"อ่านไฟล์ {filename} ไม่ได้: {e}")
    raise HTTPException(status_code=400, detail=f"ไม่รองรับนามสกุล .{ext} (รับ pdf/pptx/txt)")


# --- CSV incident KB: เลข inc, ปัญหา, สาเหตุ, การแก้ไข ---
_ALIASES = {
    "inc": {"เลข inc", "inc", "incident", "incident no", "incident_no", "เลขที่", "no"},
    "problem": {"ปัญหา", "problem", "issue", "หัวข้อ", "อาการ"},
    "cause": {"สาเหตุ", "cause", "root cause", "rootcause"},
    "fix": {"การแก้ไข", "วิธีแก้", "แก้ไข", "solution", "fix", "resolution", "แนวทางแก้ไข"},
}


def _map_headers(headers: list[str]) -> dict[str, str]:
    got: dict[str, str] = {}
    for h in headers:
        key = (h or "").strip().lower()
        for canon, names in _ALIASES.items():
            if key in {n.lower() for n in names}:
                got[canon] = h
    return got


def parse_incident_csv(data: bytes) -> list[dict]:
    text = _text(data)
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV ว่างหรือไม่มี header")
    m = _map_headers(list(reader.fieldnames))
    if "problem" not in m and "inc" not in m:
        raise HTTPException(
            status_code=400,
            detail=f"หา column ไม่เจอ ต้องมี: เลข inc, ปัญหา, สาเหตุ, การแก้ไข (เจอ: {reader.fieldnames})",
        )
    rows = []
    for r in reader:
        rows.append({
            "inc": (r.get(m.get("inc", ""), "") or "").strip(),
            "problem": (r.get(m.get("problem", ""), "") or "").strip(),
            "cause": (r.get(m.get("cause", ""), "") or "").strip(),
            "fix": (r.get(m.get("fix", ""), "") or "").strip(),
        })
    return [r for r in rows if any(r.values())]


def incident_row_text(r: dict) -> str:
    lines = []
    if r["inc"]:
        lines.append(f"เลข INC: {r['inc']}")
    if r["problem"]:
        lines.append(f"ปัญหา: {r['problem']}")
    if r["cause"]:
        lines.append(f"สาเหตุ: {r['cause']}")
    if r["fix"]:
        lines.append(f"การแก้ไข: {r['fix']}")
    return "\n".join(lines)
