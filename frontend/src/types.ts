export type Urgency = "overdue" | "critical" | "warning" | "ok" | "unknown";

export interface Incident {
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
  hours_left: number | null;
  urgency: Urgency;
  itsm_url: string | null;
}

export interface DetailsResponse {
  columns: string[];
  details: Incident[];
  count: number;
}

export interface ServiceData {
  service: string;
  incidents: Incident[];
  error?: string;
}
