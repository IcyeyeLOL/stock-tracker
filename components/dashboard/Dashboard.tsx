'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useStorage } from '@/hooks/useStorage'
import { NewsArticle } from '@/types'
import { clusterStories, detectCatalysts } from '@/lib/utils'
import { CATALYSTS, SECTORS } from '@/lib/constants'
import { useTheme } from '../ThemeProvider'

const NEWS_DEBOUNCE_MS = 800

export default function Dashboard() {
  const [news, setNews] = useStorage<NewsArticle[]>('news', [])
  const [loading, setLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [selectedSectors] = useStorage<string[]>('selectedSectors', [])
  const [customSectors] = useStorage<any[]>('customSectors', [])
  const [selectedCatalysts] = useStorage<string[]>('selectedCatalysts', [])
  const [searchQuery, setSearchQuery] = useState('')
  const { theme } = useTheme()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRunRef = useRef(true)

  const loadNews = async () => {
    setLoading(true)
    setNewsError(null)
    try {
      let allNews: NewsArticle[] = []

      if (selectedSectors.length === 0) {
        const response = await fetch('/api/news?category=business&pageSize=50', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) {
          setNewsError(data.error || data.message || 'News request failed')
          return
        }
        allNews = data.articles || []
      } else {
        // Load news for each selected sector using keywords
        const allSectors = [...SECTORS, ...customSectors]
        const sectorQueries = selectedSectors
          .map(sectorId => {
            const sector = allSectors.find(s => s.id === sectorId)
            return sector?.keywords.join(' OR ') || ''
          })
          .filter(Boolean)

        for (const query of sectorQueries) {
          try {
            const response = await fetch(`/api/news?q=${encodeURIComponent(query)}&pageSize=20`, { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok) {
              setNewsError(data.error || data.message || 'News request failed')
              return
            }
            if (data.articles) {
              allNews = [...allNews, ...data.articles]
            }
          } catch (err) {
            console.error('Error loading sector news:', err)
            setNewsError('Failed to load some sector news')
            return
          }
        }
      }

      const taggedNews = allNews.map(article => ({
        ...article,
        catalysts: detectCatalysts(article),
      }))
      const uniqueNews = Array.from(
        new Map(taggedNews.map(item => [item.url, item])).values()
      )
      setNews(uniqueNews)
    } catch (error) {
      console.error('Error loading news:', error)
      setNewsError('Failed to load news')
      setNews([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false
      loadNews()
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      loadNews()
    }, NEWS_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [selectedSectors, customSectors])

  const filteredNews = useMemo(() => {
    let filtered = news
    
    if (selectedCatalysts.length > 0) {
      filtered = filtered.filter(article =>
        article.catalysts?.some(cat => selectedCatalysts.includes(cat))
      )
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(article =>
        article.title?.toLowerCase().includes(query) ||
        article.description?.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [news, selectedCatalysts, searchQuery])

  const clusteredNews = useMemo(() => clusterStories(filteredNews), [filteredNews])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Market Dashboard</h2>
        <button
          onClick={loadNews}
          disabled={loading}
          className="px-5 py-2.5 bg-primary-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
        >
          {loading ? 'Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {newsError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">
          {newsError}
          <span className="ml-2">Add NEWS_API_KEY to .env or check your NewsAPI plan.</span>
        </div>
      )}

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search news..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-white"
        />
      </div>

      {loading && news.length === 0 ? (
        <div className="text-center py-10 text-gray-500">Loading news...</div>
      ) : clusteredNews.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No news found. Try adjusting filters.</div>
      ) : (
        <div>
          {clusteredNews.map((cluster, idx) => (
            <div key={idx} className="mb-6 p-5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {cluster.key.charAt(0).toUpperCase() + cluster.key.slice(1)} ({cluster.size} stories)
                </h3>
                <div className="flex gap-2">
                  {cluster.topCatalysts.map(catId => {
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cluster.stories.slice(0, 6).map((article, aidx) => (
                  <a
                    key={aidx}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-md transition-all hover:-translate-y-0.5"
                  >
                    <div className="text-sm font-semibold mb-2 line-clamp-2">{article.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {article.source?.name || 'Unknown'} • {new Date(article.publishedAt).toLocaleDateString()}
                    </div>
                    {article.catalysts && article.catalysts.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {article.catalysts.map(catId => {
                          const cat = CATALYSTS.find(c => c.id === catId)
                          return cat ? (
                            <span
                              key={catId}
                              className="px-1.5 py-0.5 rounded text-xs"
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
