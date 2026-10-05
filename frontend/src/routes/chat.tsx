import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Send,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_KB,
  ragChat,
  ragDeleteDocument,
  ragDocuments,
  ragStatus,
  ragUpload,
  type RagSource,
} from "@/lib/rag-api";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [{ title: "ITSM Assistant — ถาม-ตอบจากคลังความรู้" }],
  }),
  component: ChatPage,
});

type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: RagSource[];
};

function ChatPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const status = useQuery({ queryKey: ["rag-status"], queryFn: ragStatus, refetchInterval: 15_000 });
  const docs = useQuery({ queryKey: ["rag-docs"], queryFn: () => ragDocuments() });

  const services = status.data?.services ?? [];
  const [uploadService, setUploadService] = useState("");
  const [scope, setScope] = useState(ALL_KB);
  useEffect(() => {
    if (!uploadService && services[0]) setUploadService(services[0]);
  }, [services, uploadService]);

  const upload = useMutation({
    mutationFn: ({ file, service }: { file: File; service: string }) => ragUpload(file, service),
    onSuccess: (d) => {
      toast.success(`เพิ่ม "${d.name}" -> ${d.service} (${d.chunks} chunk)`);
      qc.invalidateQueries({ queryKey: ["rag-docs"] });
      qc.invalidateQueries({ queryKey: ["rag-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: ragDeleteDocument,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rag-docs"] });
      qc.invalidateQueries({ queryKey: ["rag-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  const shownDocs = useMemo(() => {
    const all = docs.data?.documents ?? [];
    return scope === ALL_KB ? all : all.filter((d) => d.service === scope);
  }, [docs.data, scope]);

  async function send() {
    const q = input.trim();
    if (!q || pending) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: q }]);
    setPending(true);
    try {
      const res = await ragChat(q, history, scope);
      setMessages((m) => [...m, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setPending(false);
    }
  }

  const ollama = status.data?.ollama;
  const ollamaBad = status.data && !ollama?.ok;
  const modelMissing = ollama?.ok && (!ollama.chat_model_ready || !ollama.embed_model_ready);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="icon">
          <Link to="/" aria-label="กลับ dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-bold tracking-tight">ITSM Assistant</h1>
        {status.data && (
          <span className="text-xs text-muted-foreground">
            {status.data.chat_model} · {status.data.documents} chunk
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">ค้นจากคลัง</span>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_KB}>ทุกคลัง</SelectItem>
              {services.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {ollamaBad && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          ต่อ Ollama ไม่ได้ ({ollama?.error}) — ตรวจว่า `ollama serve` รันอยู่ และ API Base ถูกต้อง
        </div>
      )}
      {modelMissing && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          โมเดลยังไม่พร้อม — รัน{" "}
          {!ollama?.chat_model_ready && <code>ollama pull {status.data?.chat_model}</code>}{" "}
          {!ollama?.embed_model_ready && <code>ollama pull {status.data?.embed_model}</code>}
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* คลังความรู้ */}
        <aside className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">อัปโหลดเข้าคลัง</label>
            <Select value={uploadService} onValueChange={setUploadService}>
              <SelectTrigger>
                <SelectValue placeholder="เลือก service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.pptx,.ppt,.txt,.md,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && uploadService) upload.mutate({ file: f, service: uploadService });
              e.target.value = "";
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending || !uploadService}
            className="w-full"
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            อัปโหลดเอกสาร
          </Button>
          <p className="text-xs text-muted-foreground">
            PDF · PPTX · TXT — หรือ CSV (คอลัมน์: เลข inc, ปัญหา, สาเหตุ, การแก้ไข)
          </p>

          <div className="mt-1 flex-1 space-y-1 overflow-y-auto">
            {shownDocs.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">ยังไม่มีเอกสาร</p>
            )}
            {shownDocs.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-sm"
              >
                {d.kind === "incident-csv" ? (
                  <Table2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate" title={d.name}>
                    {d.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.service} · {d.chunks} chunk
                  </p>
                </div>
                <button
                  onClick={() => del.mutate(d.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="ลบ"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* แชท */}
        <section className="flex min-h-[60vh] flex-col rounded-xl border border-border bg-surface">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <p className="pt-10 text-center text-sm text-muted-foreground">
                  ถามปัญหา แล้วผู้ช่วยจะตอบจากคลังความรู้
                  {scope !== ALL_KB ? ` "${scope}"` : ""}
                  <br />
                  เช่น “พนักงาน login HR Connect ไม่ได้ ขึ้น 403 แก้ยังไง”
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      "max-w-[85%] rounded-2xl px-4 py-2 text-sm " +
                      (m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground")
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-border/40 pt-2">
                        {m.sources.map((s, j) => (
                          <Badge key={j} variant="secondary" className="font-normal" title={s.excerpt}>
                            {s.doc_name} · {s.score.toFixed(2)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 border-t border-border p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="พิมพ์คำถาม…"
              disabled={pending}
            />
            <Button onClick={send} disabled={pending || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
