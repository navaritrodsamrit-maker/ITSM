import { useMemo, useState } from "react";
import { notifyTeams } from "./api";
import { AlertStrip, IncidentTable, ServiceCard, withLive } from "./components";
import { useIncidentFeed, useNow } from "./hooks";
import { isDone } from "./lib";
import type { Urgency } from "./types";

export default function App() {
  const { data, loading, authError, lastUpdated, refresh } = useIncidentFeed();
  const now = useNow();

  const [service, setService] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const allRows = useMemo(
    () => data.flatMap((s) => withLive(s.incidents, now)),
    [data, now]
  );

  const rows = useMemo(() => {
    let r = allRows;
    if (service) r = r.filter((x) => x.service === service);
    if (urgency) r = r.filter((x) => x.u === urgency);
    if (!showDone) r = r.filter((x) => !isDone(x.status));
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(
        (x) =>
          x.incident_no.toLowerCase().includes(s) ||
          x.problemtopic.toLowerCase().includes(s) ||
          x.to_support_name.toLowerCase().includes(s)
      );
    }
    return [...r].sort((a, b) => (a.h ?? Infinity) - (b.h ?? Infinity));
  }, [allRows, service, urgency, q, showDone]);

  const doNotify = async () => {
    setNotifying(true);
    try {
      await notifyTeams(service ?? undefined);
      setToast("ส่งแจ้งเตือนเข้า Teams แล้ว");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setNotifying(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <header className="flex flex-wrap items-center gap-3 py-4">
        <h1 className="text-lg font-bold">ITSM Watcher</h1>
        <span className="text-xs text-slate-500">
          {lastUpdated
            ? `อัปเดต ${new Date(lastUpdated).toLocaleTimeString("th-TH")}`
            : "กำลังโหลด…"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา incident / หัวข้อ / ผู้รับผิดชอบ"
            className="w-64 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm outline-none focus:border-slate-600"
          />
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            งานที่ปิดแล้ว
          </label>
          <button
            onClick={refresh}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            รีเฟรช
          </button>
          <button
            onClick={doNotify}
            disabled={notifying}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {notifying ? "กำลังส่ง…" : service ? `แจ้ง Teams: ${service}` : "แจ้ง Teams ทั้งหมด"}
          </button>
        </div>
      </header>

      {authError && (
        <div className="mb-3 rounded-lg border border-rose-800 bg-rose-950/50 px-4 py-2 text-sm text-rose-300">
          เซสชัน ITSM หมดอายุ — อัปเดต ITSM_COOKIE ใน .env ของ backend แล้ว restart
        </div>
      )}

      <AlertStrip rows={allRows} filter={urgency} setFilter={setUrgency} />

      <section className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((s) => (
          <ServiceCard
            key={s.service}
            service={s.service}
            error={s.error}
            rows={withLive(s.incidents, now)}
            active={service === s.service}
            onClick={() => setService(service === s.service ? null : s.service)}
          />
        ))}
        {loading && !data.length && (
          <div className="col-span-full py-8 text-center text-sm text-slate-500">กำลังโหลด…</div>
        )}
      </section>

      {(service || urgency) && (
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <span>ตัวกรอง:</span>
          {service && (
            <button onClick={() => setService(null)} className="rounded bg-slate-800 px-2 py-0.5">
              {service} ✕
            </button>
          )}
          {urgency && (
            <button onClick={() => setUrgency(null)} className="rounded bg-slate-800 px-2 py-0.5">
              {urgency} ✕
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40">
        <IncidentTable rows={rows} />
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
