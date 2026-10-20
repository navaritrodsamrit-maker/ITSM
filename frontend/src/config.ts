/**
 * Single source of configuration for the ITSM monitor.
 * Values can be overridden at runtime through the settings panel
 * (persisted in localStorage under SETTINGS_STORAGE_KEY).
 */

export const API_BASE: string =
  (import.meta.env['VITE_API_BASE'] as string | undefined) ?? "https://stomach-recognised-proof-lyric.trycloudflare.com";

export const ITSM_BASE: string =
  (import.meta.env['VITE_ITSM_BASE'] as string | undefined) ?? "https://itsm.cpall.co.th";

export const DEFAULT_SERVICES: string[] = [
  "Human Resource Management",
  "Store Retention Management",
  "Store Time Management",
];

export const SUPPORT_GROUPS: { label: string; value: string }[] = [
  { label: "Application Support", value: "Application Support" },
  { label: "ทั้งหมด", value: "" },
];

export const DEFAULT_SUPPORT_GROUP = "Application Support";

/** Poll interval in milliseconds. */
export const DEFAULT_POLL_INTERVAL_MS = 60_000;

/** Urgency thresholds in hours. */
export const THRESHOLDS = {
  critical: 8,
  warning: 24,
};

export const BANGKOK_TZ = "Asia/Bangkok";

export const DONE_STATUSES = ["resolved", "closed"];

export const SETTINGS_STORAGE_KEY = "itsm-monitor-settings-v1";
export const THEME_STORAGE_KEY = "itsm-monitor-theme";

export type AppSettings = {
  apiBase: string;
  /** true = ผู้ใช้ตั้ง apiBase เองในหน้าตั้งค่า, false = ตาม VITE_API_BASE เสมอ */
  apiBaseIsCustom: boolean;
  itsmBase: string;
  services: string[];
  pollIntervalMs: number;
  criticalHours: number;
  warningHours: number;
  soundEnabled: boolean;
  adminToken: string;
  itsmCookie: string;
};

export const defaultSettings: AppSettings = {
  apiBase: API_BASE,
  apiBaseIsCustom: false,
  itsmBase: ITSM_BASE,
  services: DEFAULT_SERVICES,
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  criticalHours: THRESHOLDS.critical,
  warningHours: THRESHOLDS.warning,
  soundEnabled: false,
  adminToken: "",
  itsmCookie: "",
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const merged = { ...defaultSettings, ...parsed };
    // ไม่เคย override apiBase เอง -> ตาม VITE_API_BASE ปัจจุบันเสมอ (ไม่ใช้ค่าที่ cache ค้างไว้)
    if (!merged.apiBaseIsCustom) merged.apiBase = API_BASE;
    return merged;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
