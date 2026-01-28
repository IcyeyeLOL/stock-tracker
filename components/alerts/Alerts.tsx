'use client'

import { useState, useEffect } from 'react'
import { useStorage } from '@/hooks/useStorage'
import { NewsArticle } from '@/types'
import { CATALYSTS } from '@/lib/constants'

export default function Alerts() {
  const [watchlist] = useStorage<string[]>('watchlist', [])
  const [alerts, setAlerts] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAlertCheck, setLastAlertCheck] = useStorage<string | null>('lastAlertCheck', null)

  const checkAlerts = async () => {
    setError(null)
    if (watchlist.length === 0) {
      setAlerts([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/news?category=business&pageSize=100')
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || data.message || `News request failed (${response.status})`)
        setAlerts([])
        return
      }

      const articles = data.articles || []
      const newStories = articles.filter((article: NewsArticle) => {
        const text = `${article.title} ${article.description || ''}`.toLowerCase()
        return watchlist.some(ticker => text.includes(ticker.toLowerCase()))
      })

      setAlerts(newStories)
      setLastAlertCheck(new Date().toISOString())
    } catch (err) {
      console.error('Error checking alerts:', err)
      setError('Could not load news. Check your connection and try again.')
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAlerts()
  }, [])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Alerts</h2>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Last checked: {lastAlertCheck ? new Date(lastAlertCheck).toLocaleString() : 'Never'}
        </div>
      </div>

      {watchlist.length === 0 && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm">
          Add tickers to your <strong>Watchlist</strong> first. Alerts will show news that mentions those tickers.
        </div>
      )}

      <button
        onClick={checkAlerts}
        disabled={loading || watchlist.length === 0}
        className="px-5 py-2.5 bg-primary-500 text-white rounded-lg disabled:opacity-50 mb-6 hover:bg-primary-600 transition-colors"
      >
        {loading ? 'Checking...' : '🔄 Check Alerts'}
      </button>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">
          <strong>Alerts couldn't load:</strong> {error}
          <span className="block mt-1">Check NEWS_API_KEY in .env and your NewsAPI plan (free tier has limits).</span>
        </div>
      )}

      {!error && alerts.length === 0 && watchlist.length > 0 && !loading && (
        <div className="text-center py-10 text-gray-500">
          No alerts. Your watchlist stocks haven't been mentioned recently, or news failed to load.
        </div>
      )}

      {!error && alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((article, idx) => (
            <a
              key={idx}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
            >
              <div className="text-base font-semibold mb-2 line-clamp-2">{article.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {article.source?.name || 'Unknown'} • {new Date(article.publishedAt).toLocaleDateString()}
              </div>
              {article.catalysts && article.catalysts.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {article.catalysts.map(catId => {
                    const cat = CATALYSTS.find(c => c.id === catId)
                    return cat ? (
                      <span
                        key={catId}
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: cat.color + '20',
                          color: cat.color,
                        }}
                      >
                        {cat.name}
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
