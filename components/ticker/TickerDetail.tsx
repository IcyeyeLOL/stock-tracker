'use client'

import { useState } from 'react'
import { useStorage } from '@/hooks/useStorage'
import { TickerBrief } from '@/types'

export default function TickerDetail() {
  const [watchlist] = useStorage<string[]>('watchlist', [])
  const [tickerBrief, setTickerBrief] = useState<TickerBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const briefTicker = async (ticker: string) => {
    setLoading(true)
    setSelectedTicker(ticker)
    
    try {
      const newsResponse = await fetch(`/api/news?q=${encodeURIComponent(ticker)}&pageSize=10`)
      const newsData = await newsResponse.json()
      const tickerNews = newsData.articles || []
      
      const newsSummary = tickerNews.slice(0, 5).map((a: any) => `- ${a.title}`).join('\n')
      
      const briefResponse = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Provide a brief executive summary for ticker ${ticker} based on recent news:\n\n${newsSummary}\n\nInclude: 1) Key developments, 2) Why it matters, 3) Main catalysts, 4) Risks. Keep it concise (3-4 bullets).`,
        }),
      })
      const briefData = await briefResponse.json()
      
      const forecastResponse = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Based on the news above, provide three scenarios for ${ticker}:\n\n1. Bull Case (optimistic outcome)\n2. Base Case (most likely)\n3. Bear Case (pessimistic outcome)\n\nEach scenario should include a realistic price target and reasoning.`,
        }),
      })
      const forecastData = await forecastResponse.json()
      
      setTickerBrief({
        ticker,
        news: tickerNews,
        summary: briefData.text || 'Unable to generate summary.',
        forecast: forecastData.text || 'Unable to generate forecast.',
      })
    } catch (error) {
      console.error('Error generating brief:', error)
      setTickerBrief({
        ticker,
        news: [],
        summary: 'Error generating brief. Please try again.',
        forecast: 'Error generating forecast. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Ticker Detail</h2>
      
      {!tickerBrief ? (
        <div>
          <div className="text-center py-10 text-gray-500 mb-6">
            Select a ticker from your watchlist to generate a brief.
          </div>
          {watchlist.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {watchlist.map(ticker => (
                <button
                  key={ticker}
                  onClick={() => briefTicker(ticker)}
                  disabled={loading}
                  className="px-4 py-3 bg-primary-500 text-white rounded-lg disabled:opacity-50 hover:bg-primary-600 transition-colors"
                >
                  {loading && selectedTicker === ticker ? 'Loading...' : ticker}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="p-6 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl mb-6 shadow-sm">
            <h3 className="text-xl font-semibold mb-4">
              {tickerBrief.ticker} - Executive Brief
            </h3>
            <div className="whitespace-pre-wrap leading-relaxed mb-6">
              {tickerBrief.summary}
            </div>
            <div>
              <h4 className="text-base font-semibold mb-3">Forecast Scenarios</h4>
              <div className="whitespace-pre-wrap leading-relaxed">
                {tickerBrief.forecast}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Recent News</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickerBrief.news.map((article, idx) => (
                <a
                  key={idx}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-md transition-all"
                >
                  <div className="text-sm font-semibold mb-2">{article.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {article.source?.name || 'Unknown'} • {new Date(article.publishedAt).toLocaleDateString()}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
