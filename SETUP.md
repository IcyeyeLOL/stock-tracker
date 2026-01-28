# Setup Instructions

## Prerequisites

Make sure you have Node.js installed (version 18 or higher). Check by running:
```bash
node --version
npm --version
```

If you don't have Node.js, download it from [nodejs.org](https://nodejs.org/)

## Step-by-Step Setup

### 1. Open Terminal/Command Prompt

Navigate to the project folder:
```bash
cd "c:\Users\lime7\New folder"
```

### 2. Install Dependencies

Install all required packages:
```bash
npm install
```

This will install all dependencies listed in `package.json`. It may take a few minutes.

### 3. Set Up Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Or manually create `.env` file with:**
```
NEWS_API_KEY=your_news_api_key_here
ALPHA_VANTAGE_KEY=your_alpha_vantage_key_here
OPENAI_API_KEY=your_openai_key_here
```

**Get API Keys:**
- **NewsAPI**: Free key from [newsapi.org](https://newsapi.org/register)
- **Alpha Vantage**: Free key from [alphavantage.co](https://www.alphavantage.co/support/#api-key)
- **OpenAI** (optional): For AI summaries from [platform.openai.com](https://platform.openai.com/api-keys)

### 4. Run Development Server

Start the development server:
```bash
npm run dev
```

You should see:
```
▲ Next.js 14.0.4
- Local:        http://localhost:3000
- Ready in 2.3s
```

### 5. Open in Browser

Open your browser and go to:
```
http://localhost:3000
```

## Troubleshooting

### If `npm install` fails:
- Make sure you have Node.js 18+ installed
- Try deleting `node_modules` folder and `package-lock.json`, then run `npm install` again
- On Windows, you might need to run PowerShell as Administrator

### If `npm run dev` fails:
- Make sure all dependencies are installed (`npm install` completed successfully)
- Check that port 3000 is not already in use
- Try running `npm run dev -- -p 3001` to use a different port

### If you see API errors:
- Make sure your `.env` file exists and has valid API keys
- Check that the API keys are correct (no extra spaces)
- Some APIs have rate limits on free tiers

## Available Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server (after build)
- `npm run lint` - Run ESLint

## Next Steps

Once the app is running:
1. Add stocks to your watchlist
2. Explore the dashboard
3. Set up your portfolio
4. Try the social tracking features

Enjoy your Financial Command Center! 🚀
