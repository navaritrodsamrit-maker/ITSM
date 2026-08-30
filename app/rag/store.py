"""เก็บ chunk + embedding ใน SQLite, ค้นด้วย cosine similarity (numpy)."""
import sqlite3
import struct
import time
import uuid
from pathlib import Path

import numpy as np

from ..config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, name TEXT, kind TEXT, chunks INTEGER, created REAL
);
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY, doc_id TEXT, ord INTEGER, text TEXT, embedding BLOB,
    FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
"""


def _conn() -> sqlite3.Connection:
    Path(settings.rag_db).parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(settings.rag_db)
    c.execute("PRAGMA foreign_keys=ON")
    c.executescript(_SCHEMA)
    return c


def _pack(vec: list[float]) -> bytes:
    return struct.pack(f"{len(vec)}f", *vec)


def _unpack(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float32)


def add_document(name: str, kind: str, chunks: list[str], embeddings: list[list[float]]) -> dict:
    doc_id = uuid.uuid4().hex[:12]
    with _conn() as c:
        c.execute("INSERT INTO documents VALUES (?,?,?,?,?)",
                  (doc_id, name, kind, len(chunks), time.time()))
        c.executemany(
            "INSERT INTO chunks VALUES (?,?,?,?,?)",
            [(uuid.uuid4().hex, doc_id, i, t, _pack(e))
             for i, (t, e) in enumerate(zip(chunks, embeddings))],
        )
    return {"id": doc_id, "name": name, "kind": kind, "chunks": len(chunks)}


def list_documents() -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT id,name,kind,chunks,created FROM documents ORDER BY created DESC"
        ).fetchall()
    return [{"id": r[0], "name": r[1], "kind": r[2], "chunks": r[3], "created": r[4]} for r in rows]


def delete_document(doc_id: str) -> bool:
    with _conn() as c:
        cur = c.execute("DELETE FROM documents WHERE id=?", (doc_id,))
    return cur.rowcount > 0


def clear() -> None:
    with _conn() as c:
        c.execute("DELETE FROM documents")


def search(query_vec: list[float], top_k: int) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT c.text, c.embedding, d.name, d.kind, d.id "
            "FROM chunks c JOIN documents d ON d.id=c.doc_id"
        ).fetchall()
    if not rows:
        return []
    mat = np.vstack([_unpack(r[1]) for r in rows])
    q = np.asarray(query_vec, dtype=np.float32)
    sims = mat @ q / (np.linalg.norm(mat, axis=1) * np.linalg.norm(q) + 1e-9)
    order = np.argsort(-sims)[:top_k]
    return [
        {"text": rows[i][0], "doc_name": rows[i][2], "doc_kind": rows[i][3],
         "doc_id": rows[i][4], "score": float(sims[i])}
        for i in order
    ]
