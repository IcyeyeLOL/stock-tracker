# Site Functionality Audit

This document summarizes what works, what depends on API keys, and fixes applied during the audit.

---

## API Keys Required (.env)

| Key | Used By | Required For |
|-----|---------|--------------|
| `ALPHA_VANTAGE_KEY` | Stock search, quotes | Watchlist search, Portfolio “Track Stock”, quote prices |
| `NEWS_API_KEY` | News, Dashboard, Digest, Alerts | Market dashboard, digest, alerts, ticker news |
| `OPENAI_API_KEY` | AI generate | Ticker brief/forecast, daily digest text |
| `YOUTUBE_API_KEY` | YouTube route | Social → YouTube search (PewDiePie, etc.) |

- **LinkedIn** in Social does not use an API key; it returns a “search on LinkedIn” link.
- See `API_KEYS_GUIDE.md` for how to get each key.

---

## Feature-by-Feature Status

### Dashboard
- **Works:** Loads business news when no sectors selected; loads by sector keywords when sectors are selected; catalyst + text search filter; debounced refresh (800 ms) when filters change; manual Refresh button; news error banner if API fails.
- **Requires:** `NEWS_API_KEY`.
- **Note:** Sector/catalyst filters in the sidebar affect the dashboard. With the current `useStorage` hook, filter changes apply after a refresh or when you’re already on the dashboard (no cross-component sync by default).

### Watchlist
- **Works:** Search by symbol or name (e.g. “500”, “AAPL”, “Tesla”) → calls `/api/stocks?query=…` → shows results; “Get quote” calls `/api/stocks/quote?symbol=…`; Add to watchlist; Add by symbol (with optional verify); Remove.
- **Requires:** `ALPHA_VANTAGE_KEY`.
- **Minor:** “No results” is only implied when the results list is empty; there’s no explicit “No results found” message.

### Portfolio
- **Works:** “Track Stock” adds a ticker (with optional API verify); positions with quantity, entry/current price, P&L; notes per ticker; remove ticker/position.
- **Requires:** `ALPHA_VANTAGE_KEY` for verifying tickers.
- **Difference from Watchlist:** Track Stock is a single “ticker + add” flow, not a search bar with a list of matches like Watchlist. Making it match Watchlist would require adding a search UI and results list here.

### Alerts
- **Works:** “Check Alerts” calls news API, filters articles by watchlist tickers in title/description, shows matches; last-check time in sidebar area.
- **Requires:** `NEWS_API_KEY`. Handles missing/empty `data.articles` via `|| []`.

### Ticker Detail
- **Works:** Pick a watchlist ticker → loads news for that ticker and calls AI for executive summary + forecast scenarios; shows recent news links.
- **Requires:** `NEWS_API_KEY`, `OPENAI_API_KEY`. “Unable to generate summary/forecast” usually means missing/invalid OpenAI key or API/network error.

### Digest
- **Works:** “Generate Digest” → news API + OpenAI; shows summary and key articles; “Export PDF” → confirm dialog then print dialog (user chooses “Save as PDF”); print styles force pitch-black text for digest content.
- **Requires:** `NEWS_API_KEY`, `OPENAI_API_KEY`.

### Social
- **Works:** LinkedIn tab shows “search on LinkedIn” link for the query; YouTube tab calls `/api/social/youtube?q=…` and shows channels/videos. Follow/Unfollow and links to YouTube/LinkedIn work.
- **Requires:** `YOUTUBE_API_KEY` for YouTube search. LinkedIn does not use an API key.

### Sidebar
- **Works:** Nav between all views; theme toggle; sector checkboxes (used by dashboard when filters are applied); Real-Time Stats (Stories, Watchlist, Catalysts).
- **Fix applied:** Stats (Stories/Watchlist/Catalysts) now render from storage only after mount (`mounted` state), so server and first client render both show 0 and hydration “Server: 0 / Client: 18” type mismatches are avoided.

---

## Fixes Applied in This Audit

1. **Sidebar hydration:** Stats (Stories, Watchlist, Catalysts) are 0 until `mounted` is true, then switch to values from `useStorage`, preventing server/client text mismatch.
2. **Deprecated `onKeyPress`:** Replaced with `onKeyDown` and `e.key === 'Enter'` in Portfolio (“Track Stock” input) and Social (search input).
3. **Stocks API:** `/api/stocks` uses `dynamic = 'force-dynamic'` and `fetch(..., { cache: 'no-store' })` so searches are not served from cache.

---

## Quick Sanity Checklist

- [ ] `.env` has at least `ALPHA_VANTAGE_KEY` and `NEWS_API_KEY` for core flows.
- [ ] Watchlist: search “AAPL” or “500” → results → add → quote works.
- [ ] Dashboard: loads news; error banner if news API fails; filters + Refresh behave as expected.
- [ ] Portfolio: add ticker, add position, see P&L.
- [ ] Digest: Generate → text + key articles; Export PDF → confirm → print → “Save as PDF” gives black text.
- [ ] Social → YouTube: `YOUTUBE_API_KEY` set and restriction “None” (or IPs) → search returns results.
- [ ] Ticker Detail: watchlist ticker → brief + forecast (needs `OPENAI_API_KEY`).
- [ ] No hydration error on load (Sidebar stats stay 0 until mounted).

---

## If Something “Doesn’t Work”

- **Stock search / quote:** Check `ALPHA_VANTAGE_KEY`; free tier is 5/min. If you see “no results,” try another symbol or wait a minute.
- **Dashboard empty or error banner:** Check `NEWS_API_KEY` and plan (e.g. dev/localhost limits).
- **Digest “Unable to generate”:** Check `OPENAI_API_KEY` and credits.
- **YouTube search empty:** Check `YOUTUBE_API_KEY` and that the key has no HTTP-referrer restriction (use “None” or “IP addresses”).
- **Hydration error:** Ensure you’re on the latest build where Sidebar stats use the `mounted` guard above.
