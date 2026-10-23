# UMR Locks

Phone-friendly live traffic board for **Upper Mississippi River locks 1–26** (including Lock 5A). Data comes from the U.S. Army Corps of Engineers Lock Performance Monitoring System (LPMS). Each lock shows its river **mile marker (MM)** plus pending arrivals, vessels locking, 24-hour up/down lockages, average delay, and lockmaster notes.

## Run locally

```bash
npm install
npm run dev -- --port 43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## How it works

- The browser calls `/api/locks`.
- That route proxies `lock_status_report_json?in_river_code=MI` from USACE, sanitizes control characters in the JSON, filters to UMR locks 1–26 + 5A (excludes St. Anthony Falls and Lock 27), and caches the result for about 3 minutes.
- The page auto-refreshes on the same interval.

No API keys required. If the Corps feed is briefly unavailable, the UI shows an error with retry (and keeps the last good snapshot when a refresh fails mid-session).

## Scope notes

- Lock **5A** is included (USACE code `55`).
- There is **no Lock 23** on the UMR.
- Mile markers are river miles above the Ohio River confluence, as reported by LPMS (`lockMile`).
