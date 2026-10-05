import type { Incident, PerformanceResponse } from "./incidents";
import { mockIncidents } from "./mock-incidents";

export class ItsmHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type FetchParams = {
  apiBase: string;
  services: string[];
  month: string; // YYYY-MM
  year: string; // YYYY
  supportGroup: string; // "" disables filter
};

export type ServiceResult = {
  service: string;
  incidents: Incident[];
  count: number;
  error?: string;
};

export type PollResult = {
  results: ServiceResult[];
  usedMock: boolean;
  unauthorized: boolean;
  failedServices: string[];
  fetchedAt: number;
};

async function fetchService(
  service: string,
  { apiBase, month, year, supportGroup }: FetchParams,
): Promise<ServiceResult> {
  const url = new URL(
    `${apiBase.replace(/\/$/, "")}/report/performance/details/${encodeURIComponent(service)}`,
  );
  url.searchParams.set("month", month);
  url.searchParams.set("year", year);
  url.searchParams.set("support_group", supportGroup);

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (res.status === 401) throw new ItsmHttpError(401, "unauthorized");
  if (!res.ok) throw new ItsmHttpError(res.status, `HTTP ${res.status}`);
  const data = (await res.json()) as PerformanceResponse;
  const incidents = Array.isArray(data?.details) ? data.details : [];
  return { service, incidents, count: data?.count ?? incidents.length };
}

export async function fetchAllServices(
  params: FetchParams,
  allowMockFallback: boolean,
): Promise<PollResult> {
  const settled = await Promise.allSettled(
    params.services.map((service) => fetchService(service, params)),
  );

  let unauthorized = false;
  const failedServices: string[] = [];
  const results: ServiceResult[] = settled.map((entry, i) => {
    const service = params.services[i] ?? "";
    if (entry.status === "fulfilled") return entry.value;
    const reason = entry.reason as Error;
    if (reason instanceof ItsmHttpError && reason.status === 401) unauthorized = true;
    failedServices.push(service);
    return { service, incidents: [], count: 0, error: reason?.message ?? "network error" };
  });

  const allFailed =
    failedServices.length === params.services.length && params.services.length > 0;

  if (unauthorized) {
    return { results, usedMock: false, unauthorized, failedServices, fetchedAt: Date.now() };
  }

  if (allFailed && allowMockFallback) {
    return {
      results: params.services.map((service) => {
        const incidents = mockIncidents(service);
        return { service, incidents, count: incidents.length };
      }),
      usedMock: true,
      unauthorized: false,
      failedServices,
      fetchedAt: Date.now(),
    };
  }

  if (allFailed) {
    throw new Error("ไม่สามารถเชื่อมต่อ API ได้");
  }

  return { results, usedMock: false, unauthorized: false, failedServices, fetchedAt: Date.now() };
}
