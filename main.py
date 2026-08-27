from datetime import datetime

import requests

url = "https://itsm.cpall.co.th/api/report/performance/details"

now = datetime.now()

payload = {
    "month": now.strftime("%Y-%m"),
    "year": now.strftime("%Y"),
    "column": "service",
    "value": "Human Resource Management"
}

cookies = {
    "itsm": "5cbb38db-e9f9-442e-89d2-e110ec446d1c"
}

headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/126.0.0.0 Safari/537.36",
    "Origin": "https://itsm.cpall.co.th",
    "Referer": "https://itsm.cpall.co.th/",
    "sec-ch-ua": '"Chromium";v="126", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}

r = requests.post(
    url,
    json=payload,
    cookies=cookies,
    headers=headers,
    timeout=30
)

print(r.status_code)
print(r.text)
