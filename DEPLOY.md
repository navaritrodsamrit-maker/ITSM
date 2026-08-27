# Deploy

```
Vercel (frontend)  ──HTTPS──▶  nginx :80/:443  ──▶  api container :8000 (uvicorn)
```

---

## Backend — Docker + nginx (บนเซิร์ฟเวอร์ของคุณ)

### 1. เตรียม `.env`

```bash
cp .env.example .env
```

ตั้งค่าอย่างน้อย:
```
ITSM_COOKIE=<session cookie จาก itsm.cpall.co.th>
ITSM_TEAMS_WEBHOOK=<Power Automate URL>
ITSM_CORS_ORIGINS=https://<your-app>.vercel.app
```

### 2. รัน

```bash
docker compose up -d --build
docker compose ps
curl http://localhost/health          # {"status":"ok"}
```

- `api` container ไม่ publish port ออกนอก — เข้าถึงผ่าน `nginx` เท่านั้น
- nginx ฟัง `:80` แล้ว proxy ไป `api:8000` (ตั้ง `--proxy-headers` ให้ uvicorn แล้ว)

### 3. โดเมน + HTTPS

1. ชี้ A record ของโดเมน (เช่น `api.example.com`) มาที่ IP เซิร์ฟเวอร์
2. แก้ `server_name _;` ใน [nginx/default.conf](nginx/default.conf) เป็นโดเมนจริง
3. ออก cert (แนะนำ certbot บน host หรือ container แยก):
   ```bash
   certbot certonly --standalone -d api.example.com
   mkdir -p nginx/certs
   cp /etc/letsencrypt/live/api.example.com/{fullchain,privkey}.pem nginx/certs/
   ```
4. เปิดบล็อก `server { listen 443 ... }` ใน `nginx/default.conf`, uncomment `443:443` และ volume `certs` ใน [docker-compose.yml](docker-compose.yml)
5. `docker compose up -d`

### 4. อัปเดตโค้ด

```bash
git pull && docker compose up -d --build
```

### 5. cron แจ้งเตือน (บน host)

```
*/30 * * * * curl -sS -X POST "http://localhost/notify/teams"
```

### อัปเดต cookie เมื่อหมดอายุ

แก้ `ITSM_COOKIE` ใน `.env` แล้ว `docker compose restart api`

---

## Frontend — Vercel

### 1. เชื่อม repo

- New Project → import `bebarboss/itsm-watcher`
- **Root Directory: `frontend`**  ← สำคัญ
- Framework preset: Vite (auto) — [frontend/vercel.json](frontend/vercel.json) คุมค่าที่เหลือ

### 2. Environment Variables (ใน Vercel project settings)

| Key | Value |
|---|---|
| `VITE_API_BASE` | `https://api.example.com` (โดเมน backend หลัง nginx) |
| `VITE_ITSM_BASE` | `https://itsm.cpall.co.th` |

### 3. Deploy

push ขึ้น `main` → Vercel build อัตโนมัติ
เสร็จแล้วเอาโดเมน `*.vercel.app` ไปใส่ `ITSM_CORS_ORIGINS` ใน backend `.env` แล้ว restart api

### ทดสอบ

เปิดหน้า Vercel → ควรเห็น service cards + incident table
ถ้าตารางว่าง/error → เช็ค DevTools Console:
- CORS error → `ITSM_CORS_ORIGINS` ยังไม่ตรงโดเมน Vercel
- 401 → `ITSM_COOKIE` หมดอายุ
- Failed to fetch → `VITE_API_BASE` ผิด หรือ backend ล่ม
