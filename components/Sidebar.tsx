'use client'

import { useState, useEffect } from 'react'
import { View } from '@/app/page'
import { useTheme } from './ThemeProvider'
import { SECTORS } from '@/lib/constants'
import { useStorage } from '@/hooks/useStorage'

interface SidebarProps {
  activeView: View
  setActiveView: (view: View) => void
}

export default function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const [customSectors] = useStorage('customSectors', [])
  const [selectedSectors, setSelectedSectors] = useStorage('selectedSectors', [])
  const [selectedCatalysts, setSelectedCatalysts] = useStorage('selectedCatalysts', [])
  const [watchlist] = useStorage('watchlist', [])
  const [news] = useStorage('news', [])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const navItems = [
    { id: 'dashboard' as View, label: '📊 Dashboard' },
    { id: 'watchlist' as View, label: '⭐ Watchlist' },
    { id: 'alerts' as View, label: '🔔 Alerts' },
    { id: 'ticker' as View, label: '📰 Ticker Detail' },
    { id: 'digest' as View, label: '📋 Digest' },
    { id: 'social' as View, label: '🌐 Social' },
    { id: 'portfolio' as View, label: '💼 Portfolio' },
  ]

  const stats = mounted
    ? {
        totalStories: news.length,
        watchlistSize: watchlist.length,
        catalystsFound: new Set((news || []).flatMap((n: any) => n.catalysts || [])).size,
      }
    : { totalStories: 0, watchlistSize: 0, catalystsFound: 0 }

  return (
    <div className="w-72 border-r border-gray-200 dark:border-gray-800 p-6 overflow-y-auto bg-white dark:bg-[#1a1a1a]">
      <div className="mb-8">
        <h1 className="text-xl font-semibold mb-2">📊 Command Center</h1>
        <button
          onClick={toggleTheme}
          className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </div>

      <nav className="mb-8">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full text-left px-3 py-3 mb-2 rounded-lg transition-all ${
              activeView === item.id
                ? 'bg-primary-500 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg mb-6">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">Real-Time Stats</div>
        <div className="text-xs space-y-1">
          <div>Stories: <strong>{stats.totalStories}</strong></div>
          <div>Watchlist: <strong>{stats.watchlistSize}</strong></div>
          <div>Catalysts: <strong>{stats.catalystsFound}</strong></div>
        </div>
      </div>

      <div className="mb-6">
        <div className="text-xs font-semibold mb-3">
          Sectors ({SECTORS.length + customSectors.length})
        </div>
        {[...SECTORS, ...customSectors].slice(0, 5).map(sector => (
          <label key={sector.id} className="flex items-center mb-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selectedSectors.includes(sector.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedSectors([...selectedSectors, sector.id])
                } else {
                  setSelectedSectors(selectedSectors.filter(s => s !== sector.id))
                }
              }}
              className="mr-2"
            />
            {sector.name}
            {sector.custom && (
              <span className="text-xs text-primary-500 ml-1">(Custom)</span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}
