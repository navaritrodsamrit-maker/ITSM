"""เก็บ chunk + embedding ใน ChromaDB (embedding คำนวณเองจาก Ollama bge-m3).

metadata ต่อ chunk: doc_id, doc_name, kind, service, ord, created
แยกคลังความรู้ตาม service ด้วย where={"service": ...}
"""
import asyncio
import os
import time
import uuid
from pathlib import Path

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb  # noqa: E402

from ..config import settings  # noqa: E402

_client = None
_coll = None


def _collection():
    global _client, _coll
    if _coll is None:
        Path(settings.chroma_dir).mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=settings.chroma_dir)
        _coll = _client.get_or_create_collection(
            "knowledge_base", metadata={"hnsw:space": "cosine"})
    return _coll


def _add_sync(name, kind, service, chunks, embeddings):
    doc_id = uuid.uuid4().hex[:12]
    created = time.time()
    _collection().add(
        ids=[f"{doc_id}:{i}" for i in range(len(chunks))],
        embeddings=embeddings,
        documents=chunks,
        metadatas=[
            {"doc_id": doc_id, "doc_name": name, "kind": kind,
             "service": service, "ord": i, "created": created}
            for i in range(len(chunks))
        ],
    )
    return {"id": doc_id, "name": name, "kind": kind, "service": service, "chunks": len(chunks)}


async def add_document(name, kind, service, chunks, embeddings) -> dict:
    return await asyncio.to_thread(_add_sync, name, kind, service, chunks, embeddings)


def _list_sync(service: str | None):
    where = {"service": service} if service else None
    got = _collection().get(where=where, include=["metadatas"])
    docs: dict[str, dict] = {}
    for m in got["metadatas"]:
        d = docs.setdefault(m["doc_id"], {
            "id": m["doc_id"], "name": m["doc_name"], "kind": m["kind"],
            "service": m["service"], "created": m["created"], "chunks": 0,
        })
        d["chunks"] += 1
    return sorted(docs.values(), key=lambda d: -d["created"])


async def list_documents(service: str | None = None) -> list[dict]:
    return await asyncio.to_thread(_list_sync, service)


async def count() -> int:
    return await asyncio.to_thread(lambda: _collection().count())


async def delete_document(doc_id: str) -> bool:
    def _del():
        c = _collection()
        before = c.count()
        c.delete(where={"doc_id": doc_id})
        return c.count() < before
    return await asyncio.to_thread(_del)


def _search_sync(query_vec, top_k, service):
    where = {"service": service} if service else None
    res = _collection().query(
        query_embeddings=[query_vec], n_results=top_k, where=where,
        include=["documents", "metadatas", "distances"],
    )
    out = []
    for text, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        out.append({
            "text": text, "doc_name": meta["doc_name"], "doc_kind": meta["kind"],
            "doc_id": meta["doc_id"], "service": meta["service"],
            "score": round(1.0 - dist, 4),          # cosine distance -> similarity
        })
    return out


async def search(query_vec, top_k: int, service: str | None = None) -> list[dict]:
    return await asyncio.to_thread(_search_sync, query_vec, top_k, service)
