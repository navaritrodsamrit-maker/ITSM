import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format } from "date-fns";

import { BANGKOK_TZ, DONE_STATUSES } from "@/config";

export type Incident = {
  incident_no: string;
  status: string;
  service: string;
  category: string;
  sub_category: string;
  problemtopic: string;
  support_group: string;
  group_header: string;
  to_support_name: string;
  office: string;
  priority_level: string;
  deadline: string;
  lateStatus: string;
  createDate: string;
  id: number;
};

export type PerformanceResponse = {
  columns: string[];
  details: Incident[];
  count: number;
};

export type Tier = "overdue" | "critical" | "warning" | "ok";

export type EnrichedIncident = Incident & {
  hoursLeft: number;
  deadlineDate: Date | null;
  tier: Tier;
  isDone: boolean;
  isLate: boolean;
};

export const TIER_LABEL: Record<Tier, string> = {
  overdue: "เลยกำหนด",
  critical: "วิกฤต",
  warning: "ใกล้ครบกำหนด",
  ok: "ปกติ",
};

export const TIER_ORDER: Tier[] = ["overdue", "critical", "warning", "ok"];

/** Parse "DD/MM/YYYY HH:mm" in Asia/Bangkok into a UTC-correct Date. */
export function parseBangkokDeadline(value: string): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})/);
  if (!m) {
    const fallback = new Date(value.replace(" ", "T"));
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, dd = "01", mm = "01", yyyy = "1970", hh = "00", min = "00"] = m;
  const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${min}:00`;
  const date = fromZonedTime(iso, BANGKOK_TZ);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDoneStatus(status: string) {
  return DONE_STATUSES.includes((status ?? "").trim().toLowerCase());
}

export function tierFor(
  hoursLeft: number,
  isLate: boolean,
  criticalHours: number,
  warningHours: number,
): Tier {
  if (isLate || hoursLeft < 0) return "overdue";
  if (hoursLeft < criticalHours) return "critical";
  if (hoursLeft < warningHours) return "warning";
  return "ok";
}

export function enrich(
  incident: Incident,
  now: Date,
  criticalHours: number,
  warningHours: number,
): EnrichedIncident {
  const deadlineDate = parseBangkokDeadline(incident.deadline);
  const rawHours = deadlineDate
    ? (deadlineDate.getTime() - now.getTime()) / 3_600_000
    : Number.POSITIVE_INFINITY;
  const hoursLeft = Number.isFinite(rawHours) ? Math.round(rawHours * 10) / 10 : rawHours;
  const isLate = Boolean((incident.lateStatus ?? "").trim());
  return {
    ...incident,
    deadlineDate,
    hoursLeft,
    isLate,
    isDone: isDoneStatus(incident.status),
    tier: tierFor(hoursLeft, isLate, criticalHours, warningHours),
  };
}

/** Live countdown text, e.g. "5h 12m" or "-3h 40m". */
export function countdownText(deadline: Date | null, now: Date): string {
  if (!deadline) return "—";
  const diff = deadline.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  const sign = diff < 0 ? "-" : "";
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${sign}${d}d ${h % 24}h`;
  }
  if (h > 0) return `${sign}${h}h ${String(m).padStart(2, "0")}m`;
  return `${sign}${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatBangkok(date: Date | null, pattern = "dd/MM/yyyy HH:mm") {
  if (!date) return "—";
  return format(toZonedTime(date, BANGKOK_TZ), pattern);
}

export function formatCreateDate(value: string) {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : format(d, "dd/MM/yyyy HH:mm");
}

export function itsmUrlFor(
  incident: Pick<Incident, "id" | "incident_no">,
  itsmBase: string,
) {
  if (!incident.id) return null;
  const base = itsmBase.replace(/\/$/, "");
  // เลข inc ลงท้าย -1, -2, ... (เช่น "2026/023850-1") = sub-form
  const path = /-\d+$/.test(incident.incident_no ?? "")
    ? "incidents/sub-form/form"
    : "incidents/request/main-incident";
  return `${base}/${path}?id=${incident.id}`;
}
