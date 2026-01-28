# Financial Command Center (Stock Tracker)

A comprehensive financial intelligence platform for tracking stocks, news, portfolios, and market digests. Built with Next.js, TypeScript, and Tailwind CSS.

---

## Features

| Section | Description |
|--------|-------------|
| **Dashboard** | Market news with sector and catalyst filters. Search and cluster by themes. Debounced refresh. |
| **Watchlist** | Search stocks by symbol or name (e.g. "500", "AAPL", "Tesla"), add to watchlist, fetch live quotes. |
| **Portfolio** | Track stocks and positions (quantity, entry/current price, P&L). Add notes per ticker. |
| **Alerts** | Check news for watchlist tickers. See when your stocks are mentioned. |
| **Ticker Detail** | Pick a watchlist ticker to get an AI executive summary and forecast scenarios. |
| **Digest** | Generate a daily market digest from news; export as PDF or send to your email. |
| **Social** | Search LinkedIn (links to search) and YouTube (channels/videos). Follow and unfollow. |
| **Sidebar** | Navigate views, toggle light/dark theme, filter by sectors, view real-time stats. |

Data is stored in **localStorage** (watchlist, portfolio, notes, filters). No database required for personal use.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Storage**: Browser localStorage (via custom `useStorage` hook)

---

## Prerequisites

- **Node.js** 18+ and **npm**
- Check: `node --version` and `npm --version`

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env` file in the **project root** (same folder as `package.json`):

```env
NEWS_API_KEY=your_news_api_key
ALPHA_VANTAGE_KEY=your_alpha_vantage_key
OPENAI_API_KEY=your_openai_key
YOUTUBE_API_KEY=your_youtube_key
RESEND_API_KEY=re_your_resend_key
```

**Required for core features:**

- `NEWS_API_KEY` – Dashboard, Digest, Alerts ([newsapi.org](https://newsapi.org/register))
- `ALPHA_VANTAGE_KEY` – Stock search & quotes ([alphavantage.co](https://www.alphavantage.co/support/#api-key))

**Optional:**

- `OPENAI_API_KEY` – Ticker briefs, daily digest text ([platform.openai.com](https://platform.openai.com/api-keys))
- `YOUTUBE_API_KEY` – YouTube search in Social ([Google Cloud Console](https://console.cloud.google.com/) → enable YouTube Data API v3)
- `RESEND_API_KEY` – Send digest to email ([resend.com](https://resend.com))

See **[API_KEYS_GUIDE.md](./API_KEYS_GUIDE.md)** for detailed setup and limits.

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |

---

## Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── ai/generate/        # OpenAI summaries (brief, digest)
│   │   ├── email/digest/       # Send digest via Resend
│   │   ├── news/               # NewsAPI proxy
│   │   ├── social/
│   │   │   ├── linkedin/       # LinkedIn search link
│   │   │   └── youtube/        # YouTube Data API v3
│   │   └── stocks/
│   │       ├── route.ts        # Alpha Vantage symbol search
│   │       └── quote/          # Alpha Vantage global quote
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                # Main app with sidebar + views
│   └── print.css               # Print/PDF styles for digest
├── components/
│   ├── alerts/                 # Alerts
│   ├── dashboard/              # Market dashboard
│   ├── digest/                 # Daily digest
│   ├── portfolio/              # Portfolio & positions
│   ├── social/                 # LinkedIn & YouTube
│   ├── ticker/                 # Ticker detail (brief/forecast)
│   ├── watchlist/              # Watchlist & search
│   ├── Sidebar.tsx             # Nav, theme, sectors, stats
│   └── ThemeProvider.tsx       # Light/dark theme
├── hooks/
│   └── useStorage.ts           # localStorage + React state
├── lib/
│   ├── constants.ts            # Sectors, catalysts
│   └── utils.ts                # Helpers, clustering
├── types/
│   └── index.ts                # Shared TypeScript types
├── .env                        # API keys (do not commit)
├── API_KEYS_GUIDE.md           # How to get and use API keys
└── package.json
```

---

## Main Flows

1. **Dashboard** – Load business news; use sidebar sectors/catalysts to filter. Use “Refresh” or change filters (debounced).
2. **Watchlist** – Type a symbol or name (e.g. “500”, “Tesla”), click Search, add from results. Use “Get quote” for price.
3. **Portfolio** – Add a ticker with “Track Stock”; use “Add Position” / “Edit Position” for quantity and prices.
4. **Digest** – Click “Generate Digest”; then “Export PDF” (print → Save as PDF) or “Email” (enter email, send via Resend).
5. **Ticker Detail** – Choose a watchlist ticker to get an AI brief and forecast (requires `OPENAI_API_KEY`).

---

## Troubleshooting

- **“API key not configured”** – Add the key to `.env` in the project root and **restart the dev server** (`Ctrl+C`, then `npm run dev`).
- **Stock search returns no results** – Check `ALPHA_VANTAGE_KEY`; free tier is 5 calls/min. Try again after a short wait.
- **Dashboard shows error banner** – Check `NEWS_API_KEY` and plan (e.g. localhost-only on free tier).
- **YouTube search fails** – Set `YOUTUBE_API_KEY` and in Google Cloud set Application restrictions to “None” or “IP addresses” (not HTTP referrers).
- **Digest email returns 501** – Add `RESEND_API_KEY` to `.env` and restart the dev server.

See **[API_KEYS_GUIDE.md](./API_KEYS_GUIDE.md)** for more. For step-by-step setup, see **[SETUP.md](./SETUP.md)**.

---

## Push to GitHub (repo: `stock-tracker`)

To push this project to a GitHub repo named **stock-tracker**:

### 1. Create the repo on GitHub

1. Go to [github.com](https://github.com) → **New repository**
2. Name it **stock-tracker**
3. Leave it empty (no README, no .gitignore)
4. Create the repo and copy its URL, e.g. `https://github.com/YOUR_USERNAME/stock-tracker.git`

### 2. From the project folder (Stock Tracker)

Open a terminal in **Stock Tracker** (the folder with `package.json`), then run:

```bash
# If this folder isn’t a git repo yet:
git init

# Ignore secrets (.env is already in .gitignore – don’t remove it)
git add .
git commit -m "Initial commit: Financial Command Center (Stock Tracker)"

# Use the main branch
git branch -M main

# Add your GitHub repo
git remote add origin https://github.com/DeepSpace-user_38p3fn6iTbV25TyWCNcFJ0Dxrx5/stock-tracker.git

# Push
git push -u origin main
```

If the folder already has a different `origin`, point it at this repo and push:

```bash
git remote set-url origin https://github.com/DeepSpace-user_38p3fn6iTbV25TyWCNcFJ0Dxrx5/stock-tracker.git
git push -u origin main
```

**Important:** Do not commit `.env`. It’s in `.gitignore` so `git add .` will skip it. Never add API keys to the repo.

---

## License

MIT
