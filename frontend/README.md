# ITSM Watcher

Build a real-time monitoring dashboard for an IT Service Management (ITSM) incident tracker.

UI language: Thai labels, English data values. Dark theme by default, with a light toggle.

## DATA SOURCE

A REST API (base URL from env var VITE_API_BASE, default http://localhost:8001).

Endpoint (call once per service, in parallel, then merge):

  GET {VITE_API_BASE}/report/performance/details/{service}

  optional query: ?month=YYYY-MM &year=YYYY &support_group=<name or empty string to disable filter>

  Response: { "columns": string[], "details": Incident[], "count": number }

Incident fields:

  incident_no: string        e.g. "2026/023619"

  status: string             e.g. "Work around", "Open", "In Progress", "Resolved", "Pending"

  service: string

  category: string

  sub_category: string

  problemtopic: string       (Thai, can be long)

  support_group: string

  group_header: string       (team lead)

  to_support_name: string    (assigned engineer)

  office: string

  priority_level: string     "S1" (highest) .. "S4" (lowest)

  deadline: string           format "DD/MM/YYYY HH:mm", timezone Asia/Bangkok

  lateStatus: string         "" = on time, non-empty = late

  createDate: string         "YYYY-MM-DD HH:mm:ss"

  id: number

The list of services to monitor is configurable. Start with this array in a config file

(let the user edit it easily, ideally via a settings panel that persists to localStorage):

  ["Human Resource Management", "Store Retention Management", "Store Time Management"]

Poll all services every 60s. Show a "last updated" timestamp and a manual refresh button.

Handle: HTTP 401 -> banner "เซสชัน ITSM หมดอายุ ติดต่อผู้ดูแล"; HTTP 502 / network error -> non-blocking toast, keep showing last good data.

If the API is unreachable on first load, fall back to built-in mock data so the UI is still demoable.

## DERIVED FIELDS (compute client-side)

- hoursLeft = (deadline - now) in hours, one decimal. Parse "DD/MM/YYYY HH:mm" as Asia/Bangkok.

- urgency tier:

    overdue   : hoursLeft < 0            -> red, label "เลยกำหนด"

    critical  : 0 <= hoursLeft < 8       -> red/orange, pulsing, label "วิกฤต"

    warning   : 8 <= hoursLeft < 24      -> amber, label "ใกล้ครบกำหนด"

    ok        : hoursLeft >= 24          -> green, label "ปกติ"

  If lateStatus is non-empty, force at least "overdue" styling.

- Treat status "Resolved"/"Closed" as done: mute them, exclude from alert counts, hide by default (toggle to show).

## LAYOUT

1. Top bar: title "ITSM Monitor", month/year picker (default = current), support_group filter

   (dropdown: "Application Support" default, "ทั้งหมด" = send empty), refresh button, last-updated, light/dark toggle.

2. Alert strip (sticky, only when count > 0):

   red pill "เลยกำหนด N" | orange pill "วิกฤต N (< 8 ชม.)" | amber pill "ใกล้ครบ N".

   Clicking a pill filters the table to that tier.

3. Service summary cards (grid, one per monitored service):

   - service name, total open incidents

   - mini breakdown by urgency tier (colored dots + counts)

   - the single most-urgent incident's countdown

   - card border/glow = worst tier in that service

   - click card -> filter everything below to that service

4. Incident table (main view), default sorted by hoursLeft ascending (most urgent first):

   columns: Priority (S1-S4 badge) | Incident No | Service | Status (colored badge) |

            หัวข้อปัญหา (problemtopic, truncate + tooltip/expand) | ผู้รับผิดชอบ (to_support_name) |

            Deadline (formatted) | เหลือเวลา (big countdown chip, color by tier, shows "-Xh" if overdue) | Late

   - Row background tint by urgency tier.

   - Countdown chip updates live every second (client-side ticking, no refetch).

   - Filters: service (multi), status (multi), priority (multi), text search over incident_no/problemtopic/to_support_name.

   - Column sort. Sticky header. Responsive: collapse to card list on mobile.

   - Row click -> side drawer with all fields incl. category, sub_category, office, group_header, createDate.

5. Empty state per service if count = 0: "ไม่มีงานค้าง" with green check.

## VISUAL

- Clean ops-dashboard feel (think Grafana / Linear). Rounded cards, subtle shadows, monospace for incident numbers and countdowns.

- Priority badges: S1 = red, S2 = orange, S3 = yellow, S4 = slate.

- Status badge color map (with sensible fallback for unknown values):

    Open / New -> blue, In Progress -> indigo, Work around -> purple,

    Pending / Hold -> gray, Resolved / Closed -> green.

- Accessible contrast in both themes. Numbers should be scannable at a glance from across a room (large countdown text).

- Optional: subtle sound/toast when a new incident enters "critical" or "overdue" between polls.

## TECH

- React + TypeScript + Tailwind + shadcn/ui. TanStack Query for polling. date-fns / date-fns-tz for the Bangkok parsing. No backend needed (pure frontend calling the REST API).

- Keep all config (services list, poll interval, API base, thresholds) in one src/config.ts.

## DEEP LINK TO ITSM

Each incident links to its ITSM detail page:

  itsmUrl = `https://itsm.cpall.co.th/incidents/request/main-incident?id=${incident.id}`

(base host also configurable via env VITE_ITSM_BASE, default https://itsm.cpall.co.th)

- Incident table: make the "Incident No" cell a link -> itsmUrl, target="_blank", rel="noopener",

  with a small external-link icon.

- Row detail drawer: primary button "เปิดใน ITSM ↗" -> itsmUrl (new tab).

- Service summary card: the "most-urgent incident" countdown is also a link to that incident's itsmUrl.

- If incident.id is missing/0, render the incident number as plain text (no link).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0c1d570c-1020-4ca4-8043-6c8737dce753).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
