"""ย้ายข้อมูลจาก store เดิม (SQLite rag.db) -> Chroma ครั้งเดียว."""
import sqlite3
import struct
from pathlib import Path

from ..config import settings
from . import store


async def migrate_sqlite_if_needed() -> None:
    old = Path(settings.rag_db)
    if not old.exists():
        return
    if await store.count() > 0:                # Chroma มีข้อมูลแล้ว ข้าม
        old.rename(old.with_suffix(".db.migrated"))
        return
    try:
        c = sqlite3.connect(old)
        docs = c.execute("SELECT id,name,kind FROM documents").fetchall()
        for doc_id, name, kind in docs:
            rows = c.execute(
                "SELECT text,embedding FROM chunks WHERE doc_id=? ORDER BY ord", (doc_id,)
            ).fetchall()
            if not rows:
                continue
            texts = [r[0] for r in rows]
            embs = [list(struct.unpack(f"{len(r[1]) // 4}f", r[1])) for r in rows]
            await store.add_document(name, kind, settings.rag_general, texts, embs)
        c.close()
        old.rename(old.with_suffix(".db.migrated"))
        print(f"[rag] migrated {len(docs)} document(s) from {old.name} -> Chroma")
    except Exception as e:  # noqa: BLE001
        print(f"[rag] migrate skipped: {e}")
