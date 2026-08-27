export const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:8001";

export const ITSM_BASE =
  import.meta.env.VITE_ITSM_BASE?.replace(/\/$/, "") || "https://itsm.cpall.co.th";

// fallback ถ้าเรียก /services ไม่ได้
export const FALLBACK_SERVICES = [
  "Store Retention Management",
  "Human Resource Management",
];

export const POLL_MS = 60_000;

// เกณฑ์สี (ชั่วโมงถึง deadline)
export const CRITICAL_H = 8;
export const WARNING_H = 24;
