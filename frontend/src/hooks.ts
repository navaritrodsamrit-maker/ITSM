import { useEffect, useState } from "react";
import { AuthError, fetchServiceDetails, fetchServices } from "./api";
import { POLL_MS } from "./config";
import type { ServiceData } from "./types";

// เวลาเดินทุก 1 วิ สำหรับ countdown สด
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export interface Feed {
  data: ServiceData[];
  loading: boolean;
  authError: boolean;
  lastUpdated: number | null;
  refresh: () => void;
}

export function useIncidentFeed(): Feed {
  const [services, setServices] = useState<string[]>([]);
  const [data, setData] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetchServices().then(setServices);
  }, []);

  useEffect(() => {
    if (!services.length) return;
    let alive = true;

    const load = async () => {
      try {
        const results = await Promise.all(services.map(fetchServiceDetails));
        if (!alive) return;
        setData(results);
        setAuthError(false);
        setLastUpdated(Date.now());
      } catch (e) {
        if (!alive) return;
        if (e instanceof AuthError) setAuthError(true);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [services, tick]);

  return { data, loading, authError, lastUpdated, refresh: () => setTick((n) => n + 1) };
}
