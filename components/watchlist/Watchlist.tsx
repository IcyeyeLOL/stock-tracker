'use client'

import { useState } from 'react'
import { useStorage } from '@/hooks/useStorage'
import { Stock, StockQuote } from '@/types'

interface StockSearchResult extends Stock {
  type?: string
}

export default function Watchlist() {
  const [watchlist, setWatchlist] = useStorage<string[]>('watchlist', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [manualTicker, setManualTicker] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [quoteCache, setQuoteCache] = useState<Record<string, StockQuote | null>>({})
  const [quoteLoading, setQuoteLoading] = useState<Record<string, boolean>>({})

  const runSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setSearchResults([])
    setQuoteCache(prev => ({}))
    try {
      const response = await fetch(`/api/stocks?query=${encodeURIComponent(searchQuery.trim())}`)
      const data = await response.json()
      if (data.error) {
        if (data.error.includes('rate limit')) {
          alert('API rate limit exceeded. Please wait a minute and try again.')
        } else if (data.error.includes('not configured')) {
          alert('Stock search is not configured. Add ALPHA_VANTAGE_KEY to your .env file.')
        } else {
          alert(data.error)
        }
        return
      }
      const results = (data.results || []).map((r: any) => ({
        symbol: r.symbol,
        name: r.name || '',
        region: r.region || '',
        currency: r.currency || '',
        type: r.type,
      }))
      setSearchResults(results)
    } catch (err) {
      console.error(err)
      alert('Search failed. Please try again.')
    } finally {
      setSearchLoading(false)
    }
  }

  const fetchQuote = async (symbol: string) => {
    if (quoteCache[symbol] !== undefined) return
    setQuoteLoading(prev => ({ ...prev, [symbol]: true }))
    try {
      const res = await fetch(`/api/stocks/quote?symbol=${encodeURIComponent(symbol)}`)
      const data = await res.json()
      if (data.error) {
        setQuoteCache(prev => ({ ...prev, [symbol]: null }))
        return
      }
      setQuoteCache(prev => ({ ...prev, [symbol]: data }))
    } catch {
      setQuoteCache(prev => ({ ...prev, [symbol]: null }))
    } finally {
      setQuoteLoading(prev => ({ ...prev, [symbol]: false }))
    }
  }

  const addToWatchlist = (symbol: string) => {
    const sym = symbol.toUpperCase()
    if (watchlist.includes(sym)) {
      alert(`${sym} is already in your watchlist.`)
      return
    }
    setWatchlist([...watchlist, sym])
  }

  const addManualTicker = async () => {
    const ticker = manualTicker.trim().toUpperCase()
    if (!ticker) return
    if (watchlist.includes(ticker)) {
      alert(`${ticker} is already in your watchlist.`)
      return
    }
    setAddLoading(true)
    try {
      const response = await fetch(`/api/stocks?query=${encodeURIComponent(ticker)}`)
      const data = await response.json()
      if (data.error && !data.error.includes('not configured')) {
        if (data.error.includes('rate limit')) {
          alert('API rate limit exceeded. Please wait a minute and try again.')
          return
        }
        if (!confirm(`Could not verify ${ticker}: ${data.error}\n\nAdd anyway?`)) return
      }
      if (data.results?.length) {
        const found = data.results.find((r: any) => r.symbol?.toUpperCase() === ticker)
        if (found) {
          setWatchlist([...watchlist, ticker])
          setManualTicker('')
          return
        }
      }
      if (confirm(`Add ${ticker} to watchlist anyway?`)) {
        setWatchlist([...watchlist, ticker])
        setManualTicker('')
      }
    } catch {
      if (confirm(`Error verifying ${ticker}. Add anyway?`)) {
        setWatchlist([...watchlist, ticker])
        setManualTicker('')
      }
    } finally {
      setAddLoading(false)
    }
  }

  const removeFromWatchlist = (ticker: string) => {
    setWatchlist(watchlist.filter(t => t !== ticker))
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Watchlist</h2>

      {/* Search stocks (e.g. S&P 500, AAPL) */}
      <div className="p-5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl mb-6 shadow-sm">
        <div className="text-base font-semibold mb-3">Search stocks</div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Search by name or symbol (e.g. S&P 500, AAPL, Tesla) and add results to your watchlist.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="S&P 500, AAPL, Tesla, SPY..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#2a2a2a] text-black dark:text-white"
          />
          <button
            onClick={runSearch}
            disabled={searchLoading}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg disabled:opacity-50 hover:bg-primary-600 transition-colors"
          >
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">Results</div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {searchResults.map((r) => (
                <div
                  key={r.symbol}
                  className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-semibold text-lg">{r.symbol}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm">{r.name}</span>
                    {(r.type || r.region) && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {[r.type, r.region].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => fetchQuote(r.symbol)}
                      disabled={quoteLoading[r.symbol]}
                      className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      {quoteLoading[r.symbol] ? 'Loading...' : quoteCache[r.symbol] !== undefined ? 'Refresh' : 'Get quote'}
                    </button>
                    <button
                      onClick={() => addToWatchlist(r.symbol)}
                      disabled={watchlist.includes(r.symbol.toUpperCase())}
                      className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded-md disabled:opacity-50 hover:bg-primary-600 transition-colors"
                    >
                      {watchlist.includes(r.symbol.toUpperCase()) ? 'In watchlist' : 'Add to watchlist'}
                    </button>
                  </div>
                  {quoteCache[r.symbol] && (
                    <div className="w-full mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-sm">
                      <span className="font-medium">${quoteCache[r.symbol]!.price.toFixed(2)}</span>
                      <span className={quoteCache[r.symbol]!.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {' '}{quoteCache[r.symbol]!.change >= 0 ? '+' : ''}{quoteCache[r.symbol]!.change.toFixed(2)} ({quoteCache[r.symbol]!.changePercent})
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        Volume {Number(quoteCache[r.symbol]!.volume).toLocaleString()} • {quoteCache[r.symbol]!.latestTradingDay}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Optional: add by symbol only */}
      <div className="p-5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl mb-6 shadow-sm">
        <div className="text-base font-semibold mb-3">Add by symbol</div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. AAPL"
            value={manualTicker}
            onChange={e => setManualTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addManualTicker()}
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#2a2a2a] text-black dark:text-white max-w-xs"
          />
          <button
            onClick={addManualTicker}
            disabled={addLoading}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg disabled:opacity-50 hover:bg-primary-600 transition-colors"
          >
            {addLoading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Current watchlist */}
      {watchlist.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No tickers in your watchlist. Search above and add some.</div>
      ) : (
        <div>
          <div className="text-lg font-semibold mb-4">Your watchlist</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map(ticker => (
              <div
                key={ticker}
                className="p-5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm flex justify-between items-center"
              >
                <span className="text-xl font-semibold">{ticker}</span>
                <button
                  onClick={() => removeFromWatchlist(ticker)}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
