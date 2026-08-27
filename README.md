# ITSM Report API

Wrap ITSM performance-report + แจ้งเตือน deadline เข้า MS Teams

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # ใส่ ITSM_COOKIE (+ ITSM_TEAMS_WEBHOOK ถ้าจะใช้แจ้งเตือน)
```

## Run

```bash
uvicorn app.main:app --reload --port 8001     # 8000 ถูก docker forex-ai ใช้อยู่
```

Swagger UI: http://localhost:8001/docs

## Endpoints

### `GET /report/performance/details/{value}`

```
http://localhost:8001/report/performance/details/Human%20Resource%20Management
```

| query | ค่าเริ่มต้น | |
|---|---|---|
| `month` | เดือนปัจจุบัน | `YYYY-MM` |
| `year` | ปีปัจจุบัน | |
| `support_group` | `Application Support` | `?support_group=` (ว่าง) = ไม่กรอง |

Response: `{ columns, details[], count }` — แต่ละ detail เพิ่ม field:
`hours_left` (ชม.ถึง deadline, ติดลบ = เลย), `urgency` (`overdue|critical|warning|ok|unknown`),
`itsm_url` (ลิงก์หน้า incident). เรียงตาม `hours_left` น้อย→มาก

### `POST /notify/teams` — ทุก service ใน `ITSM_SERVICES`

```bash
curl -X POST "http://localhost:8001/notify/teams"           # ทุกงานของแต่ละ service (default)
curl -X POST "http://localhost:8001/notify/teams?hours=24"  # เฉพาะงานเหลือ < 24 ชม. + status ที่แจ้งเสมอ
```

### `POST /notify/teams/{value}` — service เดียว

```bash
curl -X POST "http://localhost:8001/notify/teams/Store%20Retention%20Management"
```

| query (ใช้ได้ทั้ง 2 endpoint) | |
|---|---|
| `hours` | ใส่ = กรองเฉพาะงานเหลือ < ชม.นี้ (ไม่ใส่ = ทุกงาน) |
| `dry_run=true` | ไม่ส่งจริง คืน card ที่จะส่ง |
| `webhook` | override `ITSM_TEAMS_WEBHOOK` |
| `month` `year` `support_group` | เหมือน endpoint รายงาน |

ตั้งรายชื่อ service ที่ `ITSM_SERVICES` ใน `.env` (คั่นด้วย `,`)

- **default:** แจ้งทุก incident ของ service (เรียงตาม deadline ใกล้สุดก่อน)
- ใส่ `?hours=N`: แจ้งเฉพาะ `hours_left < N` **หรือ** status อยู่ใน `ITSM_ALWAYS_STATUS`
  (ค่าเริ่มต้น `รอดำเนินการ Assign` — งานที่ยังไม่ assign จะแจ้งเสมอแม้ยังไม่มี deadline)

### `POST /notify/teams-test?text=...`

ส่งข้อความสั้นเช็คว่า webhook ต่อติด

## ตั้ง Teams Webhook

1. ในแชนเนล Teams → ⋯ → **Workflows** → template *"Post to a channel when a webhook request is received"*
2. คัดลอก URL → ใส่ `ITSM_TEAMS_WEBHOOK` ใน `.env`
3. เช็ค: `curl -X POST http://localhost:8001/notify/teams-test`

(Incoming Webhook connector แบบเก่าถูก Microsoft ปิดแล้ว ใช้ Workflows แทน)

## แจ้งเตือนอัตโนมัติทุก N นาที

cron ฝั่ง host (แจ้งทุก service):
```
*/30 * * * * curl -sS -X POST "http://localhost:8001/notify/teams"
```

## หน้า UI (frontend/)

React + Vite + Tailwind — dashboard ดูงานทุก service, countdown deadline สด, กรอง/ค้นหา, กดแจ้ง Teams

```bash
cd frontend
npm install
cp .env.example .env        # ตั้ง VITE_API_BASE ให้ชี้ backend
npm run dev                 # http://localhost:5173
```

backend เปิด CORS (`allow_origins=["*"]`) ให้แล้ว UI polls ทุก 60 วิ

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `app/config.py` | env `ITSM_*` |
| `app/itsm_client.py` | httpx client + กรอง + คำนวณ hours_left/urgency |
| `app/notify.py` | สร้าง Adaptive Card + ส่ง Teams |
| `app/main.py` | FastAPI app + endpoints + CORS |
| `main.py` | script เดิม ยิงตรงเทสเร็ว |
| `frontend/` | React dashboard |
