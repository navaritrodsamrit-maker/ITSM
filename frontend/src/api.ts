import { API_BASE, FALLBACK_SERVICES } from "./config";
import type { DetailsResponse, Incident, ServiceData } from "./types";

export class AuthError extends Error {}

export async function fetchServices(): Promise<string[]> {
  try {
    const r = await fetch(`${API_BASE}/services`);
    if (!r.ok) throw new Error();
    const j = await r.json();
    if (Array.isArray(j.services) && j.services.length) return j.services;
  } catch {
    /* fall through */
  }
  return FALLBACK_SERVICES;
}

export async function fetchServiceDetails(service: string): Promise<ServiceData> {
  const url = `${API_BASE}/report/performance/details/${encodeURIComponent(service)}`;
  try {
    const r = await fetch(url);
    if (r.status === 401) throw new AuthError("เซสชัน ITSM หมดอายุ");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j: DetailsResponse = await r.json();
    return { service, incidents: j.details ?? [] };
  } catch (e) {
    if (e instanceof AuthError) throw e;
    return { service, incidents: [], error: (e as Error).message || "โหลดไม่สำเร็จ" };
  }
}

export async function notifyTeams(service?: string): Promise<void> {
  const path = service
    ? `/notify/teams/${encodeURIComponent(service)}`
    : `/notify/teams`;
  const r = await fetch(`${API_BASE}${path}`, { method: "POST" });
  if (!r.ok) throw new Error(`แจ้งเตือนไม่สำเร็จ (HTTP ${r.status})`);
}

// เรียงงานด่วนสุดก่อน (null deadline ไปท้าย)
export function sortIncidents(list: Incident[]): Incident[] {
  return [...list].sort((a, b) => {
    const an = a.hours_left ?? Infinity;
    const bn = b.hours_left ?? Infinity;
    return an - bn;
  });
}
