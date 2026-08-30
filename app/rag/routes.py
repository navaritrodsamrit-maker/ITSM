from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..config import settings
from . import store
from .extract import extract, parse_incident_csv
from .ingest import ingest_document, ingest_incidents
from .ollama import OllamaError, chat, embed, health

router = APIRouter(prefix="/rag", tags=["rag"])

_MAX_MB = 25


@router.get("/status")
async def status():
    return {"ollama": await health(),
            "documents": len(store.list_documents()),
            "chat_model": settings.chat_model, "embed_model": settings.embed_model}


@router.get("/documents")
async def documents():
    return {"documents": store.list_documents()}


@router.delete("/documents/{doc_id}")
async def remove(doc_id: str):
    if not store.delete_document(doc_id):
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")
    return {"deleted": doc_id}


async def _read(f: UploadFile) -> bytes:
    data = await f.read()
    if len(data) > _MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"ไฟล์เกิน {_MAX_MB}MB")
    return data


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    """PDF / PPTX / TXT -> ตัด chunk -> embed -> เก็บ."""
    data = await _read(file)
    text = extract(file.filename or "file", data)
    try:
        doc = await ingest_document(file.filename or "file",
                                    (file.filename or "").rsplit(".", 1)[-1].lower(), text)
    except OllamaError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return doc


@router.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """CSV: เลข inc, ปัญหา, สาเหตุ, การแก้ไข -> 1 แถว = 1 chunk."""
    data = await _read(file)
    rows = parse_incident_csv(data)
    try:
        doc = await ingest_incidents(file.filename or "incidents.csv", rows)
    except OllamaError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {**doc, "rows": len(rows)}


class ChatIn(BaseModel):
    message: str
    history: list[dict] = []          # [{role, content}, ...] ไม่รวมข้อความล่าสุด
    top_k: int | None = None


_SYSTEM = (
    "คุณเป็นผู้ช่วยฝ่าย IT Support ตอบคำถามจากคลังความรู้ที่ให้มาเท่านั้น "
    "ตอบเป็นภาษาไทย กระชับ ตรงประเด็น ถ้าข้อมูลไม่พอให้บอกว่าไม่พบข้อมูลในคลังความรู้ "
    "เมื่ออ้างถึงเคสให้ระบุเลข INC ด้วย"
)


@router.post("/chat")
async def rag_chat(body: ChatIn):
    q = body.message.strip()
    if not q:
        raise HTTPException(status_code=400, detail="ข้อความว่าง")
    try:
        qvec = (await embed([q]))[0]
    except OllamaError as e:
        raise HTTPException(status_code=502, detail=str(e))

    hits = store.search(qvec, body.top_k or settings.rag_top_k)
    context = "\n\n---\n\n".join(
        f"[{h['doc_name']}] {h['text']}" for h in hits
    ) or "(ไม่มีเอกสารในคลังความรู้)"

    messages = [
        {"role": "system", "content": _SYSTEM},
        *body.history[-8:],
        {"role": "user", "content": f"คลังความรู้:\n{context}\n\nคำถาม: {q}"},
    ]
    try:
        answer = await chat(messages)
    except OllamaError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "answer": answer,
        "sources": [
            {"doc_name": h["doc_name"], "doc_id": h["doc_id"], "kind": h["doc_kind"],
             "score": round(h["score"], 3), "excerpt": h["text"][:300]}
            for h in hits
        ],
    }
