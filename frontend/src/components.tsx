import { useMemo, useState } from "react";
import type { Incident, Urgency } from "./types";
import {
  countdownText,
  hoursLeft,
  isDone,
  PRIORITY_BADGE,
  statusBadge,
  urgencyOf,
  URGENCY_CHIP,
  URGENCY_LABEL,
  URGENCY_ROW,
} from "./lib";

export interface Live extends Incident {
  h: number | null;
  u: Urgency;
}

export function withLive(list: Incident[], now: number): Live[] {
  return list.map((d) => {
    const h = hoursLeft(d.deadline, now);
    return { ...d, h, u: urgencyOf(h, d.lateStatus) };
  });
}

function Chip({ u, big }: { u: Urgency; big?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md font-mono font-semibold ring-1 ${URGENCY_CHIP[u]} ${
        big ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs"
      } ${u === "critical" || u === "overdue" ? "pulse" : ""}`}
    >
      {URGENCY_LABEL[u]}
    </span>
  );
}

export function AlertStrip({
  rows,
  filter,
  setFilter,
}: {
  rows: Live[];
  filter: Urgency | null;
  setFilter: (u: Urgency | null) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { overdue: 0, critical: 0, warning: 0 };
    rows.forEach((r) => {
      if (isDone(r.status)) return;
      if (r.u in c) c[r.u]++;
    });
    return c;
  }, [rows]);

  const pills: { u: Urgency; label: string }[] = [
    { u: "overdue", label: `เลยกำหนด ${counts.overdue}` },
    { u: "critical", label: `วิกฤต ${counts.critical}` },
    { u: "warning", label: `ใกล้ครบ ${counts.warning}` },
  ];
  if (!counts.overdue && !counts.critical && !counts.warning) return null;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur">
      {pills.map((p) => (
        <button
          key={p.u}
          onClick={() => setFilter(filter === p.u ? null : p.u)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
            URGENCY_CHIP[p.u]
          } ${filter === p.u ? "outline outline-2 outline-offset-1 outline-slate-400" : ""}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function ServiceCard({
  service,
  rows,
  error,
  active,
  onClick,
}: {
  service: string;
  rows: Live[];
  error?: string;
  active: boolean;
  onClick: () => void;
}) {
  const open = rows.filter((r) => !isDone(r.status));
  const by: Record<string, number> = { overdue: 0, critical: 0, warning: 0, ok: 0, unknown: 0 };
  open.forEach((r) => by[r.u]++);
  const worst: Urgency =
    (["overdue", "critical", "warning", "ok"] as Urgency[]).find((u) => by[u] > 0) || "ok";
  const top = [...open].sort((a, b) => (a.h ?? Infinity) - (b.h ?? Infinity))[0];

  const ring =
    worst === "overdue"
      ? "ring-rose-500/50"
      : worst === "critical"
      ? "ring-orange-500/50"
      : worst === "warning"
      ? "ring-amber-500/40"
      : "ring-slate-800";

  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left ring-1 transition hover:bg-slate-900 ${ring} ${
        active ? "outline outline-2 outline-offset-2 outline-sky-500" : ""
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{service}</span>
        <span className="font-mono text-2xl">{open.length}</span>
      </div>
      {error ? (
        <span className="text-xs text-rose-400">โหลดไม่สำเร็จ: {error}</span>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
            {by.overdue > 0 && <span className="text-rose-400">● เลยกำหนด {by.overdue}</span>}
            {by.critical > 0 && <span className="text-orange-400">● วิกฤต {by.critical}</span>}
            {by.warning > 0 && <span className="text-amber-400">● ใกล้ครบ {by.warning}</span>}
            {by.ok > 0 && <span className="text-emerald-400">● ปกติ {by.ok}</span>}
            {by.unknown > 0 && <span>● ไม่มี deadline {by.unknown}</span>}
            {open.length === 0 && <span className="text-emerald-400">✓ ไม่มีงานค้าง</span>}
          </div>
          {top && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>ด่วนสุด:</span>
              <span className="font-mono">{top.incident_no}</span>
              <Chip u={top.u} />
              <span className="font-mono">{countdownText(top.h)}</span>
            </div>
          )}
        </>
      )}
    </button>
  );
}

function Drawer({ inc, onClose }: { inc: Live; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-slate-800 bg-slate-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-lg">{inc.incident_no}</div>
            <div className="mt-1 flex gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ${PRIORITY_BADGE[inc.priority_level] ?? PRIORITY_BADGE.S4}`}>
                {inc.priority_level || "-"}
              </span>
              <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${statusBadge(inc.status)}`}>
                {inc.status || "-"}
              </span>
              <Chip u={inc.u} />
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">✕</button>
        </div>

        <p className="mb-4 text-sm text-slate-300">{inc.problemtopic}</p>

        <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
          {[
            ["Service", inc.service],
            ["Category", inc.category],
            ["Sub Category", inc.sub_category],
            ["Support Group", inc.support_group],
            ["Group Header", inc.group_header],
            ["ผู้รับผิดชอบ", inc.to_support_name],
            ["สถานที่", inc.office],
            ["Deadline", inc.deadline || "—"],
            ["เหลือเวลา", countdownText(inc.h)],
            ["สร้างเมื่อ", inc.createDate],
            ["Late", inc.lateStatus || "—"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k}</dt>
              <dd className="col-span-2 break-words text-slate-200">{v || "—"}</dd>
            </div>
          ))}
        </dl>

        {inc.itsm_url && (
          <a
            href={inc.itsm_url}
            target="_blank"
            rel="noopener"
            className="mt-5 inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            เปิดใน ITSM ↗
          </a>
        )}
      </div>
    </div>
  );
}

export function IncidentTable({ rows }: { rows: Live[] }) {
  const [open, setOpen] = useState<Live | null>(null);

  if (!rows.length)
    return <div className="p-8 text-center text-sm text-slate-500">ไม่มีงานตรงเงื่อนไข</div>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
            <tr>
              {["Pri", "Incident", "Service", "Status", "หัวข้อปัญหา", "ผู้รับผิดชอบ", "Deadline", "เหลือเวลา"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id || r.incident_no}
                onClick={() => setOpen(r)}
                className={`cursor-pointer border-b border-slate-900 hover:bg-slate-900/60 ${URGENCY_ROW[r.u]} ${
                  isDone(r.status) ? "opacity-50" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ${PRIORITY_BADGE[r.priority_level] ?? PRIORITY_BADGE.S4}`}>
                    {r.priority_level || "-"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">
                  {r.itsm_url ? (
                    <a href={r.itsm_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="text-sky-400 hover:underline">
                      {r.incident_no} ↗
                    </a>
                  ) : (
                    r.incident_no
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.service}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${statusBadge(r.status)}`}>{r.status || "-"}</span>
                </td>
                <td className="max-w-[22rem] truncate px-3 py-2 text-slate-300" title={r.problemtopic}>
                  {r.problemtopic}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.to_support_name || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-400">{r.deadline || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`inline-flex rounded-md px-2 py-1 font-mono text-sm font-semibold ring-1 ${URGENCY_CHIP[r.u]} ${
                    r.u === "critical" || r.u === "overdue" ? "pulse" : ""
                  }`}>
                    {countdownText(r.h)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <Drawer inc={open} onClose={() => setOpen(null)} />}
    </>
  );
}
