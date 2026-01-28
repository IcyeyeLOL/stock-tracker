'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Dashboard from '@/components/dashboard/Dashboard'
import Watchlist from '@/components/watchlist/Watchlist'
import Alerts from '@/components/alerts/Alerts'
import TickerDetail from '@/components/ticker/TickerDetail'
import Digest from '@/components/digest/Digest'
import Social from '@/components/social/Social'
import Portfolio from '@/components/portfolio/Portfolio'

export type View = 'dashboard' | 'watchlist' | 'alerts' | 'ticker' | 'digest' | 'social' | 'portfolio'

export default function Home() {
  const [activeView, setActiveView] = useState<View>('dashboard')

  return (
    <div className="flex h-screen bg-white dark:bg-[#0a0a0a] text-black dark:text-white">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      
      <main className="flex-1 overflow-y-auto p-8">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'watchlist' && <Watchlist />}
        {activeView === 'alerts' && <Alerts />}
        {activeView === 'ticker' && <TickerDetail />}
        {activeView === 'digest' && <Digest />}
        {activeView === 'social' && <Social />}
        {activeView === 'portfolio' && <Portfolio />}
      </main>
    </div>
  )
}
