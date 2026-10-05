import { loadSettings } from "@/config";

function base() {
  return loadSettings().apiBase.replace(/\/$/, "");
}

export const ALL_KB = "__all__";

export type RagDoc = {
  id: string;
  name: string;
  kind: string;
  service: string;
  chunks: number;
  created: number;
};

export type RagSource = {
  doc_name: string;
  doc_id: string;
  kind: string;
  service: string;
  score: number;
  excerpt: string;
};

export type RagStatus = {
  ollama: {
    ok: boolean;
    error?: string;
    models?: string[];
    chat_model_ready?: boolean;
    embed_model_ready?: boolean;
  };
  documents: number;
  chat_model: string;
  embed_model: string;
  services: string[];
};

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      if (b?.detail) detail = typeof b.detail === "string" ? b.detail : JSON.stringify(b.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function ragStatus() {
  return fetch(`${base()}/rag/status`).then(j<RagStatus>);
}

export function ragDocuments(service?: string) {
  const q = service && service !== ALL_KB ? `?service=${encodeURIComponent(service)}` : "";
  return fetch(`${base()}/rag/documents${q}`).then(j<{ documents: RagDoc[] }>);
}

export function ragDeleteDocument(id: string) {
  return fetch(`${base()}/rag/documents/${id}`, { method: "DELETE" }).then(j<{ deleted: string }>);
}

export function ragUpload(file: File, service: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("service", service);
  const isCsv = /\.csv$/i.test(file.name);
  return fetch(`${base()}/rag/${isCsv ? "upload-csv" : "upload"}`, {
    method: "POST",
    body: fd,
  }).then(j<RagDoc & { rows?: number }>);
}

export function ragChat(
  message: string,
  history: { role: string; content: string }[],
  service?: string,
) {
  return fetch(`${base()}/rag/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      service: service && service !== ALL_KB ? service : null,
    }),
  }).then(j<{ answer: string; sources: RagSource[] }>);
}
