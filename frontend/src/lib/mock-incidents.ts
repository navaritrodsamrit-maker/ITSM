import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { BANGKOK_TZ } from "@/config";
import type { Incident } from "./incidents";

function deadlineIn(hours: number) {
  const d = new Date(Date.now() + hours * 3_600_000);
  return format(toZonedTime(d, BANGKOK_TZ), "dd/MM/yyyy HH:mm");
}

function createdAgo(hours: number) {
  const d = new Date(Date.now() - hours * 3_600_000);
  return format(d, "yyyy-MM-dd HH:mm:ss");
}

type Seed = {
  no: string;
  status: string;
  topic: string;
  engineer: string;
  priority: string;
  hours: number;
  late?: boolean;
};

const SEEDS: Record<string, Seed[]> = {
  "Human Resource Management": [
    {
      no: "2026/023619",
      status: "Work around",
      topic: "ระบบบันทึกเวลาพนักงานไม่สามารถดึงข้อมูลจากเครื่องสแกนสาขาได้ ทำให้ยอดชั่วโมงทำงานไม่ตรง",
      engineer: "Somchai Wong",
      priority: "S1",
      hours: -6.2,
      late: true,
    },
    {
      no: "2026/023701",
      status: "In Progress",
      topic: "หน้าจออนุมัติวันลาแสดง error 500 เมื่อกดยืนยันคำขอย้อนหลัง",
      engineer: "Napat Chai",
      priority: "S2",
      hours: 3.4,
    },
    {
      no: "2026/023744",
      status: "Open",
      topic: "รายงานเงินเดือนส่งออกไฟล์ Excel ช้ากว่าปกติมาก",
      engineer: "Pornthip S.",
      priority: "S3",
      hours: 18.5,
    },
    {
      no: "2026/023780",
      status: "Resolved",
      topic: "ผู้ใช้ลืมรหัสผ่านเข้าระบบ HR portal",
      engineer: "Napat Chai",
      priority: "S4",
      hours: 40,
    },
  ],
  "Store Retention Management": [
    {
      no: "2026/023812",
      status: "Open",
      topic: "แคมเปญสะสมแสตมป์ไม่ตัดยอดลูกค้าสมาชิกที่สาขาภาคเหนือ",
      engineer: "Kittipong R.",
      priority: "S1",
      hours: 1.1,
    },
    {
      no: "2026/023833",
      status: "Pending",
      topic: "ข้อมูลลูกค้าซ้ำซ้อนหลัง sync ระบบ CRM รอบกลางคืน",
      engineer: "Areeya P.",
      priority: "S2",
      hours: 12.75,
    },
    {
      no: "2026/023850",
      status: "New",
      topic: "Dashboard อัตราการกลับมาซื้อซ้ำแสดงกราฟว่างเปล่า",
      engineer: "Kittipong R.",
      priority: "S3",
      hours: 30,
    },
  ],
  "Store Time Management": [
    {
      no: "2026/023877",
      status: "In Progress",
      topic: "ตารางกะพนักงานสาขาไม่บันทึกหลังแก้ไขเวลาเข้างาน",
      engineer: "Wanchai T.",
      priority: "S2",
      hours: 6.8,
    },
    {
      no: "2026/023890",
      status: "Hold",
      topic: "รออนุมัติจากเจ้าของระบบเพื่อปรับสูตรคำนวณ OT",
      engineer: "Wanchai T.",
      priority: "S4",
      hours: 55,
    },
  ],
};

let idCounter = 90000;

export function mockIncidents(service: string): Incident[] {
  const seeds = SEEDS[service] ?? SEEDS["Store Time Management"] ?? [];
  return seeds.map((s, i) => ({
    incident_no: s.no,
    status: s.status,
    service,
    category: "Application",
    sub_category: "Defect",
    problemtopic: s.topic,
    support_group: "Application Support",
    group_header: "Sittichai K.",
    to_support_name: s.engineer,
    office: "Head Office - Silom",
    priority_level: s.priority,
    deadline: deadlineIn(s.hours),
    lateStatus: s.late ? "Late" : "",
    createDate: createdAgo(s.hours + 48),
    id: idCounter + i + service.length,
  }));
}
