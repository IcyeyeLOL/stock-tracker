# API Keys Guide

Here's what API keys you need and how to get them:

## Required API Keys

### 1. **NEWS_API_KEY** ⭐ Required
**What it's for:** Fetching financial news articles

**How to get it:**
1. Go to [https://newsapi.org/register](https://newsapi.org/register)
2. Sign up for a free account
3. After registration, you'll see your API key on the dashboard
4. Copy the key (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

**Free Tier Limits:**
- 100 requests per day
- Perfect for development and personal use

---

### 2. **ALPHA_VANTAGE_KEY** ⭐ Required
**What it's for:** Searching stock symbols and validating tickers

**How to get it:**
1. Go to [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
2. Fill out the form (name, email, organization)
3. Click "GET FREE API KEY"
4. Check your email for the API key
5. Copy the key (looks like: `ABCD1234EFGH5678`)

**Free Tier Limits:**
- 5 API calls per minute
- 500 calls per day
- Good for basic stock searches

---

### 3. **OPENAI_API_KEY** ⚠️ Optional (but recommended)
**What it's for:** AI-powered summaries, ticker briefs, and daily digests

**How to get it:**
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign up or log in to OpenAI
3. Click "Create new secret key"
4. Copy the key immediately (you won't see it again!)
5. Looks like: `sk-proj-abc123def456ghi789...`

**Pricing:**
- Pay-as-you-go (very cheap for this use case)
- ~$0.15 per 1M tokens for GPT-4o-mini
- Each summary costs pennies

**Note:** Without this key, the "Brief Me" and "Generate Digest" features won't work, but everything else will.

---

### 4. **YOUTUBE_API_KEY** ⚠️ Optional (for Social Tracking)
**What it's for:** Searching YouTube channels and videos in Social Tracking

**How to get it:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **"YouTube Data API v3"** (APIs & Services → Library → search "YouTube Data API v3" → Enable)
4. Go to Credentials → Create Credentials → API Key
5. Copy the key (looks like: `AIzaSyAbc123Def456Ghi789...`)

**Important for this app:** Requests go from your Next.js server, not the browser. In Credentials → your API key → Application restrictions, use **"None"** (or "IP addresses" if you prefer). Do **not** use "HTTP referrers"—that blocks server-side requests and causes "referrer blocked" errors.

**Free Tier Limits:**
- 10,000 units per day
- More than enough for personal use

**Note:** Without this key, YouTube search won't work, but LinkedIn search will still work (redirects to LinkedIn).

---

### 5. **RESEND_API_KEY** ⚠️ Optional (for Email Digest)
**What it's for:** Sending the daily digest to an email address from the Digest page ("Email" button).

**How to get it:**
1. Go to [resend.com](https://resend.com) and sign up
2. In the dashboard, go to API Keys → Create API Key
3. Copy the key (looks like: `re_xxxxxxxxxxxx`)

**Sending from:** By default the app uses Resend's test address `onboarding@resend.dev`. For production, add a verified domain in Resend and set `RESEND_FROM=Your App <digest@yourdomain.com>` in `.env`.

**Note:** Without this key, the "Email" modal will show an error asking you to add `RESEND_API_KEY`. Export PDF and the rest of the digest still work.

---

## Setting Up Your .env File

1. **Create `.env` file** in the project root:
   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env
   ```

2. **Open `.env` file** and add your keys:
   ```env
   NEWS_API_KEY=your_actual_news_api_key_here
   ALPHA_VANTAGE_KEY=your_actual_alpha_vantage_key_here
   OPENAI_API_KEY=your_actual_openai_key_here
   YOUTUBE_API_KEY=your_youtube_api_key_here
   RESEND_API_KEY=re_your_resend_key_here
   ```

3. **Save the file** (make sure there are no spaces around the `=` sign)

4. **Restart your dev server** if it's running:
   ```bash
   # Stop with Ctrl+C, then:
   npm run dev
   ```

---

## What Works Without API Keys?

✅ **Works without any keys:**
- UI navigation
- Dark/Light mode
- Local storage (watchlist, portfolio, etc.)
- Component rendering

❌ **Won't work without keys:**
- **No NEWS_API_KEY:** Dashboard won't load news, alerts won't work
- **No ALPHA_VANTAGE_KEY:** Can't search/verify stock symbols (but can still add manually)
- **No OPENAI_API_KEY:** "Brief Me" and "Generate Digest" buttons will error
- **No YOUTUBE_API_KEY:** YouTube search in Social Tracking won't work (LinkedIn still works)
- **No RESEND_API_KEY:** "Email" on Digest will show "Add RESEND_API_KEY to .env" (Export PDF still works)

---

## Quick Setup Checklist

- [ ] Get NewsAPI key (free, 2 minutes)
- [ ] Get Alpha Vantage key (free, 2 minutes)
- [ ] Get OpenAI key (optional, requires payment method)
- [ ] Create `.env` file
- [ ] Add all keys to `.env`
- [ ] Restart dev server
- [ ] Test the app!

---

## Troubleshooting

**"API key not configured" error:**
- Make sure `.env` file exists in project root
- Check for typos in variable names (must be exact: `NEWS_API_KEY`, etc.)
- No spaces around `=` sign
- Restart dev server after adding keys

**"Rate limit exceeded" error:**
- Alpha Vantage: Wait 1 minute between requests
- NewsAPI: Wait until next day (100 requests/day limit)
- OpenAI: Check your usage at platform.openai.com

**Keys not working:**
- Double-check you copied the entire key (no missing characters)
- Make sure you're using the right key for the right service
- Some APIs take a few minutes to activate after registration

---

## Security Note

⚠️ **Never commit your `.env` file to Git!** It's already in `.gitignore`, but double-check before pushing to GitHub.
