export interface NewsArticle {
  title: string
  description?: string
  url: string
  urlToImage?: string
  publishedAt: string
  source: {
    name: string
  }
  catalysts?: string[]
}

export interface Stock {
  symbol: string
  name: string
  region: string
  currency: string
  type?: string
}

export interface StockQuote {
  symbol: string
  price: number
  open: number
  high: number
  low: number
  change: number
  changePercent: string
  volume: string
  latestTradingDay: string
}

export interface Position {
  ticker: string
  quantity: number
  entryPrice: number
  currentPrice: number
  targetPrice?: number
  costBasis: number
  currentValue: number
  pl: number
  plPercent: number
}

export interface SocialAccount {
  id: string
  platform: 'linkedin' | 'youtube'
  name: string
  headline?: string
  location?: string
  channelTitle?: string
  description?: string
  publishedAt?: string
  videoId?: string
  channelId?: string
}

export interface Sector {
  id: string
  name: string
  keywords: string[]
  custom?: boolean
}

export interface Catalyst {
  id: string
  name: string
  color: string
  keywords: string[]
}

export interface TickerBrief {
  ticker: string
  summary: string
  forecast: string
  news: NewsArticle[]
}

export interface Digest {
  date: string
  content: string
  articles: NewsArticle[]
}
