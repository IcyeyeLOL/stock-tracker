'use client'

import { useState } from 'react'
import { useStorage } from '@/hooks/useStorage'
import { Position } from '@/types'

export default function Portfolio() {
  const [watchlist, setWatchlist] = useStorage<string[]>('watchlist', [])
  const [positions, setPositions] = useStorage<Record<string, Position>>('positions', {})
  const [tickerNotes, setTickerNotes] = useStorage<Record<string, string>>('tickerNotes', {})
  const [newTickerInput, setNewTickerInput] = useState('')
  const [editingPosition, setEditingPosition] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const addTickerToWatchlist = async () => {
    if (!newTickerInput.trim()) return
    
    const ticker = newTickerInput.trim().toUpperCase()
    
    // Check if already in watchlist
    if (watchlist.includes(ticker)) {
      alert(`${ticker} is already in your watchlist.`)
      return
    }
    
    setLoading(true)
    try {
      const response = await fetch(`/api/stocks?query=${encodeURIComponent(ticker)}`)
      const data = await response.json()
      
      if (data.error) {
        // If API fails, still allow adding (user might know better)
        if (confirm(`Could not verify ${ticker}. Add anyway?`)) {
          setWatchlist([...watchlist, ticker])
          setNewTickerInput('')
          alert(`${ticker} added to tracking!`)
        }
      } else if (data.results && data.results.length > 0) {
        // Found the ticker, add it
        setWatchlist([...watchlist, ticker])
        setNewTickerInput('')
        alert(`${ticker} added to tracking!`)
      } else {
        // Not found, ask user
        if (confirm(`Could not find ticker ${ticker}. Add anyway?`)) {
          setWatchlist([...watchlist, ticker])
          setNewTickerInput('')
          alert(`${ticker} added to tracking!`)
        }
      }
    } catch (error) {
      console.error('Error adding ticker:', error)
      // On error, still allow adding
      if (confirm(`Error verifying ${ticker}. Add anyway?`)) {
        setWatchlist([...watchlist, ticker])
        setNewTickerInput('')
        alert(`${ticker} added to tracking!`)
      }
    } finally {
      setLoading(false)
    }
  }

  const updatePosition = (ticker: string, positionData: Partial<Position>) => {
    const current = positions[ticker] || { ticker, quantity: 0, entryPrice: 0, currentPrice: 0, costBasis: 0, currentValue: 0, pl: 0, plPercent: 0 }
    const updated = { ...current, ...positionData }
    const costBasis = (updated.quantity || 0) * (updated.entryPrice || 0)
    const currentValue = (updated.quantity || 0) * (updated.currentPrice || updated.entryPrice || 0)
    const pl = currentValue - costBasis
    const plPercent = costBasis > 0 ? ((pl / costBasis) * 100) : 0
    
    setPositions({
      ...positions,
      [ticker]: {
        ...updated,
        costBasis,
        currentValue,
        pl,
        plPercent,
      },
    })
  }

  const allTickers = [...new Set([...watchlist, ...Object.keys(positions)])]
  const totalCost = Object.values(positions).reduce((sum, pos) => sum + pos.costBasis, 0)
  const totalValue = Object.values(positions).reduce((sum, pos) => sum + pos.currentValue, 0)
  const totalPL = totalValue - totalCost
  const totalPLPercent = totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(2) : '0.00'

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Portfolio</h2>
      
      <div className="p-5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl mb-6 shadow-sm">
        <div className="text-base font-semibold mb-3">Track Stock</div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Add a stock symbol to track on your dashboard.
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter ticker symbol (e.g., AAPL, TSLA)"
            value={newTickerInput}
            onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && addTickerToWatchlist()}
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#2a2a2a] text-black dark:text-white"
          />
          <button
            onClick={addTickerToWatchlist}
            disabled={loading}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg disabled:opacity-50 hover:bg-primary-600 transition-colors"
          >
            {loading ? 'Adding...' : 'Track Stock'}
          </button>
        </div>
      </div>

      {Object.keys(positions).length > 0 && (
        <div className="p-5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl mb-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Portfolio Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Cost</div>
              <div className="text-xl font-semibold">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Value</div>
              <div className="text-xl font-semibold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">P&L</div>
              <div className={`text-xl font-semibold ${totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalPLPercent}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {allTickers.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No positions tracked. Add stocks above to get started!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allTickers.map(ticker => {
            const position = positions[ticker]
            const notes = tickerNotes[ticker] || ''

            return (
              <div key={ticker} className="p-5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-xl font-semibold">{ticker}</div>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${ticker} from tracking?`)) {
                        setWatchlist(watchlist.filter(t => t !== ticker))
                        const newPositions = { ...positions }
                        delete newPositions[ticker]
                        setPositions(newPositions)
                        const newNotes = { ...tickerNotes }
                        delete newNotes[ticker]
                        setTickerNotes(newNotes)
                      }
                    }}
                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>

                {editingPosition === ticker ? (
                  <div>
                    <div className="mb-3">
                      <label className="block text-xs mb-1">Quantity</label>
                      <input
                        type="number"
                        value={position?.quantity || ''}
                        onChange={(e) => updatePosition(ticker, { quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#2a2a2a] text-black dark:text-white"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs mb-1">Entry Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={position?.entryPrice || ''}
                        onChange={(e) => updatePosition(ticker, { entryPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#2a2a2a] text-black dark:text-white"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs mb-1">Current Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={position?.currentPrice || ''}
                        onChange={(e) => updatePosition(ticker, { currentPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#2a2a2a] text-black dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          updatePosition(ticker, {
                            quantity: position?.quantity || 0,
                            entryPrice: position?.entryPrice || 0,
                            currentPrice: position?.currentPrice || 0,
                          })
                          setEditingPosition(null)
                        }}
                        className="flex-1 px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPosition(null)}
                        className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-800 text-black dark:text-white rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {position?.quantity ? (
                      <div className="mb-4">
                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">Quantity</div>
                            <div className="font-semibold">{position.quantity}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">Entry</div>
                            <div className="font-semibold">${position.entryPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">Current</div>
                            <div className="font-semibold">${position.currentPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">P&L</div>
                            <div className={`font-semibold ${position.pl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              ${position.pl.toFixed(2)} ({position.plPercent.toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                        No position data. Click "Edit Position" to add.
                      </div>
                    )}
                    
                    <button
                      onClick={() => setEditingPosition(ticker)}
                      className="w-full px-3 py-2 bg-primary-500 text-white rounded text-sm hover:bg-primary-600 transition-colors mb-3"
                    >
                      {position?.quantity ? 'Edit Position' : 'Add Position'}
                    </button>

                    <div>
                      <div className="text-xs font-semibold mb-2">Notes</div>
                      <textarea
                        value={notes}
                        onChange={(e) => setTickerNotes({ ...tickerNotes, [ticker]: e.target.value })}
                        placeholder="Add notes about this stock..."
                        className="w-full min-h-20 px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#2a2a2a] text-black dark:text-white text-sm resize-y"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
