import re

from fastapi import HTTPException

from ..config import settings
from . import store
from .extract import incident_row_text
from .ollama import embed

_PARA = re.compile(r"\n\s*\n")


def chunk(text: str) -> list[str]:
    size, overlap = settings.rag_chunk_chars, settings.rag_chunk_overlap
    text = text.strip()
    if not text:
        return []
    paras = [p.strip() for p in _PARA.split(text) if p.strip()]
    out: list[str] = []
    buf = ""
    for p in paras:
        if len(buf) + len(p) + 2 <= size:
            buf = f"{buf}\n\n{p}" if buf else p
            continue
        if buf:
            out.append(buf)
        if len(p) <= size:
            buf = p
        else:                                   # ย่อหน้ายาวเกิน — ตัดเป็นช่วง
            for i in range(0, len(p), size - overlap):
                out.append(p[i:i + size])
            buf = ""
    if buf:
        out.append(buf)
    return out


def resolve_service(service: str | None) -> str:
    s = (service or "").strip() or settings.rag_general
    if s not in settings.rag_services:
        raise HTTPException(
            status_code=400,
            detail=f"service ไม่ถูกต้อง: {s} (ใช้ได้: {settings.rag_services})",
        )
    return s


async def ingest_document(name: str, kind: str, service: str, text: str) -> dict:
    chunks = chunk(text)
    if not chunks:
        raise HTTPException(status_code=400, detail=f"{name}: ไม่พบข้อความในไฟล์")
    vecs = await embed(chunks)
    return await store.add_document(name, kind, service, chunks, vecs)


async def ingest_incidents(name: str, service: str, rows: list[dict]) -> dict:
    chunks = [t for t in (incident_row_text(r) for r in rows) if t.strip()]
    if not chunks:
        raise HTTPException(status_code=400, detail="CSV ไม่มีข้อมูลที่ใช้ได้")
    vecs = await embed(chunks)
    return await store.add_document(name, "incident-csv", service, chunks, vecs)
