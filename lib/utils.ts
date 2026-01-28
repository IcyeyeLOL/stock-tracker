import { NewsArticle, Catalyst } from '@/types'
import { CATALYSTS } from './constants'

export function detectCatalysts(article: NewsArticle): string[] {
  const text = `${article.title} ${article.description || ''}`.toLowerCase()
  return CATALYSTS.filter(catalyst =>
    catalyst.keywords.some(keyword => text.includes(keyword.toLowerCase()))
  ).map(c => c.id)
}

export function clusterStories(articles: NewsArticle[]) {
  const clusters: Record<string, NewsArticle[]> = {}
  
  articles.forEach(article => {
    const words = article.title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4)
    
    let bestCluster: string | null = null
    let bestScore = 0
    
    Object.keys(clusters).forEach(clusterKey => {
      const clusterWords = clusterKey.split(' ')
      const matches = words.filter(w => clusterWords.includes(w)).length
      const score = matches / Math.max(clusterWords.length, words.length)
      if (score > 0.3 && score > bestScore) {
        bestScore = score
        bestCluster = clusterKey
      }
    })
    
    if (bestCluster) {
      clusters[bestCluster].push(article)
    } else {
      const keyWord = words[0] || 'other'
      if (!clusters[keyWord]) {
        clusters[keyWord] = []
      }
      clusters[keyWord].push(article)
    }
  })
  
  return Object.entries(clusters)
    .map(([key, stories]) => ({
      key,
      stories,
      size: stories.length,
      topCatalysts: getTopCatalysts(stories),
    }))
    .sort((a, b) => b.size - a.size)
}

function getTopCatalysts(stories: NewsArticle[]) {
  const catalystCounts: Record<string, number> = {}
  stories.forEach(story => {
    story.catalysts?.forEach(cat => {
      catalystCounts[cat] = (catalystCounts[cat] || 0) + 1
    })
  })
  return Object.entries(catalystCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id)
}

export function parsePriceFromNews(article: NewsArticle) {
  const text = `${article.title} ${article.description || ''}`
  const percentMatch = text.match(/(?:up|down|rose|fell|gained|lost)\s+([\d.]+)%/i)
  const priceMatch = text.match(/\$([\d,]+\.?\d*)/g)
  if (percentMatch) return { change: parseFloat(percentMatch[1]), type: 'percent' as const }
  if (priceMatch) return { change: parseFloat(priceMatch[0].replace(/[$,]/g, '')), type: 'price' as const }
  return null
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
