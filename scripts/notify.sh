#!/bin/bash
# ยิงแจ้งเตือน Teams — เรียกจาก launchd ทุก 30 นาที
# ทำงานเฉพาะ จ-ศ 08:00-20:00 (เวลาเครื่อง = Asia/Bangkok)

URL="${ITSM_NOTIFY_URL:-http://localhost:8001/notify/teams}"
LOG="$HOME/Library/Logs/itsm-watcher/notify.log"
mkdir -p "$(dirname "$LOG")"

dow=$(date +%u)   # 1=จันทร์ .. 7=อาทิตย์
hour=$(date +%H)

if [ "$dow" -ge 6 ]; then exit 0; fi                       # เสาร์-อาทิตย์
if [ "$hour" -lt 8 ] || [ "$hour" -ge 20 ]; then exit 0; fi # นอกเวลา 08-20

echo "[$(date '+%F %T')] POST $URL" >> "$LOG"
curl -sS -m 60 -X POST "$URL" >> "$LOG" 2>&1
echo >> "$LOG"
