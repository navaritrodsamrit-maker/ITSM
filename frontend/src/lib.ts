import { CRITICAL_H, WARNING_H } from "./config";
import type { Urgency } from "./types";

// "DD/MM/YYYY HH:mm" (เวลาไทย) -> Date  | null ถ้า parse ไม่ได้
export function parseDeadline(s: string): Date | null {
  const m = s?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi] = m;
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00+07:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function hoursLeft(deadline: string, now: number): number | null {
  const d = parseDeadline(deadline);
  if (!d) return null;
  return (d.getTime() - now) / 3_600_000;
}

export function urgencyOf(h: number | null, late: string): Urgency {
  if (late?.trim()) return "overdue";
  if (h === null) return "unknown";
  if (h < 0) return "overdue";
  if (h < CRITICAL_H) return "critical";
  if (h < WARNING_H) return "warning";
  return "ok";
}

export function countdownText(h: number | null): string {
  if (h === null) return "—";
  const neg = h < 0;
  const abs = Math.abs(h);
  const d = Math.floor(abs / 24);
  const hh = Math.floor(abs % 24);
  const mm = Math.floor((abs * 60) % 60);
  const core = d > 0 ? `${d}d ${hh}h` : hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
  return neg ? `-${core}` : core;
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  overdue: "เลยกำหนด",
  critical: "วิกฤต",
  warning: "ใกล้ครบกำหนด",
  ok: "ปกติ",
  unknown: "ไม่ทราบ",
};

// tailwind classes
export const URGENCY_CHIP: Record<Urgency, string> = {
  overdue: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
  critical: "bg-orange-500/15 text-orange-300 ring-orange-500/40",
  warning: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  ok: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  unknown: "bg-slate-500/15 text-slate-300 ring-slate-500/40",
};

export const URGENCY_ROW: Record<Urgency, string> = {
  overdue: "bg-rose-500/[0.07]",
  critical: "bg-orange-500/[0.06]",
  warning: "bg-amber-500/[0.05]",
  ok: "",
  unknown: "",
};

export const PRIORITY_BADGE: Record<string, string> = {
  S1: "bg-rose-500/20 text-rose-300 ring-rose-500/40",
  S2: "bg-orange-500/20 text-orange-300 ring-orange-500/40",
  S3: "bg-amber-500/20 text-amber-300 ring-amber-500/40",
  S4: "bg-slate-500/20 text-slate-300 ring-slate-500/40",
};

export function statusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("resolve") || s.includes("closed") || s.includes("done"))
    return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (s.includes("progress")) return "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30";
  if (s.includes("work around")) return "bg-violet-500/15 text-violet-300 ring-violet-500/30";
  if (s.includes("รอ") || s.includes("pending") || s.includes("hold"))
    return "bg-slate-500/15 text-slate-300 ring-slate-500/30";
  if (s.includes("assign") || s.includes("open") || s.includes("new"))
    return "bg-sky-500/15 text-sky-300 ring-sky-500/30";
  return "bg-slate-500/15 text-slate-300 ring-slate-500/30";
}

export function isDone(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("resolve") || s.includes("closed") || s.includes("done");
}
