/**
 * Financial Command Center — single file for copy-paste into widget.
 * Uses miyagiAPI.post(endpoint, body) → { success, data } and useStorage(key, initial, { scope: 'user' }).
 *
 * DEEP SPACE: All APIs (news, stock search, AI, social) first use Deep Space's miyagiAPI when available.
 * If Deep Space doesn't support an endpoint or returns an error, we fall back to YOUR backend when
 * WIDGET_API_BASE is set. Set it to your deployed Stock Tracker URL (e.g. 'https://your-app.vercel.app')
 * so stock search and other features work if Deep Space doesn't provide them.
 *
 * LOCALHOST: Leave WIDGET_API_BASE empty; fallback calls same-origin /api/*.
 */
import React, { useState, useEffect, useMemo } from 'react';

// When pasting into Deep Space, set this to your deployed Stock Tracker URL so stock search, AI, social work.
// You can also set it at runtime: in Deep Space, use the "Backend URL" field in the sidebar, or set
// window.FINANCIAL_COMMAND_CENTER_API_BASE or localStorage 'financial.commandCenter.apiBase'.
const WIDGET_API_BASE = '';

function getApiBase() {
  if (typeof window === 'undefined') return WIDGET_API_BASE;
  const runtime = (window.FINANCIAL_COMMAND_CENTER_API_BASE || '').trim()
    || (typeof localStorage !== 'undefined' && localStorage.getItem('financial.commandCenter.apiBase') || '').trim();
  return (WIDGET_API_BASE || runtime) || '';
}

function _buildApiUrl(path) {
  const url = path.startsWith('/') ? path : `/${path}`;
  if (url.startsWith('http')) return url;
  const base = getApiBase();
  if (base) {
    return `${base.replace(/\/$/, '')}${url}`;
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin + url;
  }
  return url;
}

async function _request(url, options = {}) {
  try {
    const fullUrl = _buildApiUrl(url);
    const res = await fetch(fullUrl, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || data.message || res.statusText };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'Request failed' };
  }
}

// Fallback: calls YOUR backend (same-origin on localhost, or WIDGET_API_BASE when set for Deep Space).
function _fallbackPost(endpoint, body = {}) {
  const b = body;
  if (endpoint === '/news-top-headlines') {
    const category = b.category || 'business';
    const country = b.country || 'us';
    const pageSize = b.pageSize || 50;
    return _request(`/api/news?category=${encodeURIComponent(category)}&country=${encodeURIComponent(country)}&pageSize=${pageSize}`).then(({ ok, data, error }) =>
      ok ? { success: true, data: { articles: (data && data.articles) || [] } } : { success: false, error: error || 'Request failed' }
    );
  }
  if (endpoint === '/news-search') {
    const q = b.q || b.query || '';
    const pageSize = b.pageSize || 20;
    return _request(`/api/news?q=${encodeURIComponent(q)}&pageSize=${pageSize}`).then(({ ok, data, error }) =>
      ok ? { success: true, data: { articles: (data && data.articles) || [] } } : { success: false, error: error || 'Request failed' }
    );
  }
  if (endpoint === '/generate-text') {
    const prompt = (b.messages && b.messages[0] && b.messages[0].content) ?? b.prompt ?? '';
    const model = b.model || 'gpt-4o-mini';
    return _request('/api/ai/generate', { method: 'POST', body: JSON.stringify({ prompt, model }) }).then(({ ok, data, error }) =>
      ok ? { success: true, data: { text: (data && data.text) || '' } } : { success: false, error: error || 'Request failed' }
    );
  }
  if (endpoint === '/search-stocks') {
    const query = b.term ?? b.query ?? '';
    return _request(`/api/stocks?query=${encodeURIComponent(query)}`).then(({ ok, data, error }) => {
      if (!ok) return { success: false, error: error || 'Request failed' };
      const symbols = (data && data.results) || [];
      return { success: true, data: { symbols } };
    });
  }
  if (endpoint === '/linkedin-search-profiles') {
    const q = b.name ?? b.q ?? b.query ?? '';
    return _request(`/api/social/linkedin?q=${encodeURIComponent(q)}`).then(({ ok, data, error }) => {
      if (!ok) return { success: false, error: error || 'Request failed' };
      const results = (data && data.results) || [];
      const profiles = results.map((r) => ({ ...r, link: r.searchUrl || r.link }));
      return { success: true, data: { profiles } };
    });
  }
  if (endpoint === '/youtube-search') {
    const q = b.q ?? b.query ?? '';
    const maxResults = b.maxResults ?? 20;
    return _request(`/api/social/youtube?q=${encodeURIComponent(q)}&maxResults=${maxResults}`).then(({ ok, data, error }) => {
      if (!ok) return { success: false, error: error || 'Request failed' };
      const results = (data && data.results) || [];
      const videos = results.map((r) => ({
        ...r,
        id: r.id || r.videoId || r.channelId,
        videoId: r.videoId,
        channelId: r.channelId,
        snippet: {
          title: r.name,
          channelTitle: r.channelTitle,
          channelId: r.channelId,
          description: r.description,
          publishedAt: r.publishedAt,
        },
        links: { watch: r.videoId ? `https://www.youtube.com/watch?v=${r.videoId}` : r.channelId ? `https://www.youtube.com/channel/${r.channelId}` : undefined },
      }));
      return { success: true, data: { videos } };
    });
  }
  if (endpoint === '/send-email') return Promise.resolve({ success: true });
  return Promise.resolve({ success: false, error: `Unknown endpoint: ${endpoint}` });
}

const deepSpace = typeof globalThis.miyagiAPI !== 'undefined';

// Normalize Deep Space response so our UI always sees { success, data: { symbols } } etc.
function _normalizeResponse(endpoint, res) {
  if (!res || !res.success || !res.data) return res;
  const d = res.data;
  if (endpoint === '/search-stocks' && !d.symbols && Array.isArray(d.results)) {
    return { success: true, data: { ...d, symbols: d.results } };
  }
  if ((endpoint === '/news-top-headlines' || endpoint === '/news-search') && !d.articles && Array.isArray(d.results)) {
    return { success: true, data: { ...d, articles: d.results } };
  }
  return res;
}

const miyagiAPI = {
  post: async (endpoint, body = {}) => {
    if (deepSpace) {
      try {
        const res = await globalThis.miyagiAPI.post(endpoint, body);
        const normalized = _normalizeResponse(endpoint, res);
        if (normalized && normalized.success) return normalized;
        // Deep Space failed or doesn't support this endpoint; try user's backend if URL is set
        if (getApiBase()) return _fallbackPost(endpoint, body);
        return normalized || res;
      } catch (e) {
        if (getApiBase()) return _fallbackPost(endpoint, body);
        return { success: false, error: (e && e.message) || 'Request failed' };
      }
    }
    return _fallbackPost(endpoint, body);
  },
};

const useStorage = typeof globalThis.useStorage !== 'undefined' ? globalThis.useStorage : function useStorage(key, initialValue, opts) {
  const [storedValue, setStoredValue] = useState(initialValue);
  useEffect(() => {
    try {
      const item = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
      setStoredValue(item != null ? JSON.parse(item) : initialValue);
    } catch (err) {
      console.error('Error loading from localStorage:', err);
    }
  }, [key]);
  const setValue = (valueOrUpdater) => {
    if (typeof valueOrUpdater === 'function') {
      setStoredValue((prev) => {
        const nextValue = valueOrUpdater(prev);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, JSON.stringify(nextValue));
          }
        } catch (err) {
          console.error('Error saving to localStorage:', err);
        }
        return nextValue;
      });
    } else {
      try {
        setStoredValue(valueOrUpdater);
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, JSON.stringify(valueOrUpdater));
        }
      } catch (err) {
        console.error('Error saving to localStorage:', err);
      }
    }
  };
  return [storedValue, setValue];
};

const SECTORS = [
  { id: 'technology', name: 'Technology', keywords: ['tech', 'software', 'AI', 'cloud', 'SaaS'] },
  { id: 'healthcare', name: 'Healthcare', keywords: ['pharma', 'biotech', 'medical', 'health'] },
  { id: 'finance', name: 'Finance', keywords: ['banking', 'financial', 'investment', 'trading'] },
  { id: 'energy', name: 'Energy', keywords: ['oil', 'gas', 'renewable', 'energy'] },
  { id: 'consumer', name: 'Consumer', keywords: ['retail', 'consumer', 'goods', 'brands'] },
  { id: 'industrial', name: 'Industrial', keywords: ['manufacturing', 'industrial', 'machinery'] },
  { id: 'real-estate', name: 'Real Estate', keywords: ['real estate', 'REIT', 'property'] },
  { id: 'materials', name: 'Materials', keywords: ['materials', 'chemicals', 'mining'] },
];

const CATALYSTS = [
  { id: 'earnings', name: 'Earnings', color: '#6366f1', keywords: ['earnings', 'revenue', 'profit', 'quarterly', 'EPS'] },
  { id: 'guidance', name: 'Guidance', color: '#10b981', keywords: ['guidance', 'forecast', 'outlook', 'expectations'] },
  { id: 'macro', name: 'Macro', color: '#f59e0b', keywords: ['Fed', 'inflation', 'interest rates', 'GDP', 'economic'] },
  { id: 'regulation', name: 'Regulation', color: '#ef4444', keywords: ['SEC', 'regulation', 'compliance', 'law', 'legal'] },
  { id: 'product', name: 'Product', color: '#8b5cf6', keywords: ['launch', 'release', 'product', 'unveil'] },
  { id: 'm-a', name: 'M&A', color: '#ec4899', keywords: ['merger', 'acquisition', 'deal', 'buyout'] },
];

function FinancialCommandCenter() {
  const [watchlist, setWatchlist] = useStorage('financial.watchlist', [], { scope: 'user' });
  const [customSectors, setCustomSectors] = useStorage('financial.customSectors', [], { scope: 'user' });
  const [positions, setPositions] = useStorage('financial.positions', {}, { scope: 'user' });
  const [tickerNotes, setTickerNotes] = useStorage('financial.tickerNotes', {}, { scope: 'user' });
  const [followedAccounts, setFollowedAccounts] = useStorage('financial.followedAccounts', [], { scope: 'user' });
  const [lastAlertCheck, setLastAlertCheck] = useStorage('financial.lastAlertCheck', null, { scope: 'user' });

  const [activeView, setActiveView] = useState('dashboard');
  const [news, setNews] = useState([]);
  const [newsError, setNewsError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [selectedCatalysts, setSelectedCatalysts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [tickerBrief, setTickerBrief] = useState(null);
  const [digest, setDigest] = useState(null);
  const [socialSearchPlatform, setSocialSearchPlatform] = useState('linkedin');
  const [socialSearchQuery, setSocialSearchQuery] = useState('');
  const [socialResults, setSocialResults] = useState([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState(null);
  const [hasSocialSearched, setHasSocialSearched] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [newTickerInput, setNewTickerInput] = useState('');
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorKeywords, setNewSectorKeywords] = useState('');
  const [positionForm, setPositionForm] = useState({ ticker: '', quantity: '', entryPrice: '' });
  const [portfolioSearchQuery, setPortfolioSearchQuery] = useState('');
  const [portfolioSearchResults, setPortfolioSearchResults] = useState([]);
  const [portfolioSearching, setPortfolioSearching] = useState(false);
  const [editingPositionData, setEditingPositionData] = useState({});
  const [refreshingQuotes, setRefreshingQuotes] = useState({});
  const [watchlistSearchQuery, setWatchlistSearchQuery] = useState('');
  const [watchlistSearchResults, setWatchlistSearchResults] = useState([]);
  const [watchlistSearchError, setWatchlistSearchError] = useState(null);
  const [watchlistSearching, setWatchlistSearching] = useState(false);
  const [watchlistQuotes, setWatchlistQuotes] = useState({});
  const [loadingWatchlistQuotes, setLoadingWatchlistQuotes] = useState({});
  const [hasSearched, setHasSearched] = useState(false);
  const [portfolioSearchError, setPortfolioSearchError] = useState(null);
  const [portfolioHasSearched, setPortfolioHasSearched] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [backendUrl, setBackendUrl] = useState('');
  const [backendUrlSaved, setBackendUrlSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage) {
      setBackendUrl(localStorage.getItem('financial.commandCenter.apiBase') || '');
    }
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = '#ffffff';
    document.body.style.color = '#000000';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
      document.documentElement.style.minHeight = '';
    };
  }, []);

  useEffect(() => {
    loadNews();
    checkAlerts();
  }, []);

  useEffect(() => {
    if (selectedSectors.length > 0) loadNews();
  }, [selectedSectors]);

  useEffect(() => {
    if (watchlist.length > 0 && alerts.length === 0) checkAlerts();
  }, [watchlist]);

  const loadNews = async () => {
    setLoading(true);
    setNewsError(null);
    try {
      let allNews = [];
      if (selectedSectors.length === 0) {
        const response = await miyagiAPI.post('/news-top-headlines', {
          category: 'business',
          country: 'us',
          pageSize: 50,
        });
        if (response.success) {
          allNews = response.data.articles || [];
        } else {
          setNewsError(response.error || 'Failed to load news');
        }
      } else {
        const allSectors = [...SECTORS, ...(customSectors || [])];
        const sectorQueries = selectedSectors
          .map((sectorId) => {
            const sector = allSectors.find((s) => s.id === sectorId);
            return sector?.keywords.join(' OR ') || '';
          })
          .filter(Boolean);
        for (const query of sectorQueries) {
          try {
            const response = await miyagiAPI.post('/news-search', {
              q: query,
              language: 'en',
              sortBy: 'publishedAt',
              pageSize: 20,
            });
            if (response.success && response.data.articles) {
              allNews = [...allNews, ...response.data.articles];
            }
          } catch (err) {
            console.error('Error loading sector news:', err);
          }
        }
      }
      const taggedNews = allNews.map((article) => ({
        ...article,
        catalysts: detectCatalysts(article),
      }));
      const uniqueNews = Array.from(
        new Map(taggedNews.map((item) => [item.url, item])).values()
      );
      setNews(uniqueNews);
    } catch (error) {
      console.error('Error loading news:', error);
      setNews([]);
      setNewsError((error && error.message) || 'Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  const detectCatalysts = (article) => {
    const text = `${(article && article.title) || ''} ${(article && article.description) || ''}`.toLowerCase();
    return CATALYSTS.filter((catalyst) =>
      catalyst.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
    ).map((c) => c.id);
  };

  const clusterStories = (articles) => {
    const clusters = {};
    (articles || []).forEach((article) => {
      const words = ((article && article.title) || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 4);
      let bestCluster = null;
      let bestScore = 0;
      Object.keys(clusters).forEach((clusterKey) => {
        const clusterWords = clusterKey.split(' ');
        const matches = words.filter((w) => clusterWords.includes(w)).length;
        const score = matches / Math.max(clusterWords.length, words.length);
        if (score > 0.3 && score > bestScore) {
          bestScore = score;
          bestCluster = clusterKey;
        }
      });
      if (bestCluster) {
        clusters[bestCluster].push(article);
      } else {
        const keyWord = words[0] || 'other';
        if (!clusters[keyWord]) clusters[keyWord] = [];
        clusters[keyWord].push(article);
      }
    });
    return Object.entries(clusters)
      .map(([key, stories]) => ({
        key,
        stories,
        size: stories.length,
        topCatalysts: getTopCatalysts(stories),
      }))
      .sort((a, b) => b.size - a.size);
  };

  const getTopCatalysts = (stories) => {
    const catalystCounts = {};
    (stories || []).forEach((story) => {
      (story.catalysts || []).forEach((cat) => {
        catalystCounts[cat] = (catalystCounts[cat] || 0) + 1;
      });
    });
    return Object.entries(catalystCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
  };

  const checkAlerts = async () => {
    if (watchlist.length === 0) return;
    try {
      const response = await miyagiAPI.post('/news-top-headlines', {
        category: 'business',
        country: 'us',
        pageSize: 100,
      });
      if (response.success) {
        const newStories = (response.data.articles || []).filter((article) => {
          const text = `${article.title} ${article.description || ''}`.toLowerCase();
          return watchlist.some((ticker) => text.includes(ticker.toLowerCase()));
        });
        setAlerts(newStories);
        setLastAlertCheck(new Date().toISOString());
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  };

  const briefTicker = async (ticker) => {
    setLoading(true);
    setSelectedTicker(ticker);
    setActiveView('ticker');
    try {
      const newsResponse = await miyagiAPI.post('/news-search', {
        q: ticker,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
      });
      const tickerNews = newsResponse.success ? (newsResponse.data.articles || []) : [];
      const newsSummary = tickerNews
        .slice(0, 5)
        .map((a) => `- ${a.title}`)
        .join('\n');
      const briefResponse = await miyagiAPI.post('/generate-text', {
        model: 'gpt-4o-mini',
        prompt: `Provide a brief executive summary for ticker ${ticker} based on recent news:\n\n${newsSummary}\n\nInclude: 1) Key developments, 2) Why it matters, 3) Main catalysts, 4) Risks. Keep it concise (3-4 bullets).`,
      });
      const forecastResponse = await miyagiAPI.post('/generate-text', {
        model: 'gpt-4o-mini',
        prompt: `Based on the news above, provide three scenarios for ${ticker}:\n\n1. Bull Case (optimistic outcome)\n2. Base Case (most likely)\n3. Bear Case (pessimistic outcome)\n\nEach scenario should include a realistic price target and reasoning.`,
      });
      setTickerBrief({
        ticker,
        news: tickerNews,
        summary: briefResponse.success ? (briefResponse.data.text || 'Unable to generate summary.') : 'Unable to generate summary.',
        forecast: forecastResponse.success ? (forecastResponse.data.text || 'Unable to generate forecast.') : 'Unable to generate forecast.',
      });
    } catch (error) {
      console.error('Error generating brief:', error);
      setTickerBrief({
        ticker,
        news: [],
        summary: 'Error generating brief. Please try again.',
        forecast: 'Error generating forecast. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDigest = async () => {
    setLoading(true);
    try {
      const response = await miyagiAPI.post('/news-top-headlines', {
        category: 'business',
        country: 'us',
        pageSize: 50,
      });
      const articles = response.success ? (response.data.articles || []) : [];
      const topMovers = watchlist.slice(0, 5).map((ticker) => {
        const tickerNews = articles.filter((a) =>
          `${a.title} ${a.description || ''}`.toLowerCase().includes(ticker.toLowerCase())
        );
        return { ticker, newsCount: tickerNews.length };
      }).sort((a, b) => b.newsCount - a.newsCount);
      const digestPrompt = `Generate a daily market digest based on these headlines:\n\n${articles.slice(0, 20).map((a) => `- ${a.title}`).join('\n')}\n\nInclude: 1) Market summary, 2) Key movers (${topMovers.map((t) => t.ticker).join(', ')}), 3) Catalysts to watch, 4) Actionable insights. Format as a professional newsletter.`;
      const digestResponse = await miyagiAPI.post('/generate-text', {
        model: 'gpt-4o-mini',
        prompt: digestPrompt,
      });
      setDigest({
        date: new Date().toLocaleDateString(),
        content: digestResponse.success ? (digestResponse.data.text || 'Unable to generate digest.') : 'Unable to generate digest.',
        articles: articles.slice(0, 10),
      });
    } catch (error) {
      console.error('Error generating digest:', error);
      setDigest({
        date: new Date().toLocaleDateString(),
        content: 'Error generating digest. Please try again.',
        articles: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const addCustomSector = () => {
    if (!newSectorName.trim() || !newSectorKeywords.trim()) return;
    const newSector = {
      id: `custom-${Date.now()}`,
      name: newSectorName.trim(),
      keywords: newSectorKeywords.split(',').map((k) => k.trim()).filter(Boolean),
      custom: true,
    };
    setCustomSectors((prev) => [...(prev || []), newSector]);
    setNewSectorName('');
    setNewSectorKeywords('');
  };

  const deleteCustomSector = (sectorId) => {
    setCustomSectors((prev) => (prev || []).filter((s) => s.id !== sectorId));
    setSelectedSectors((prev) => prev.filter((s) => s !== sectorId));
  };

  const searchSocial = async () => {
    if (!socialSearchQuery.trim()) return;
    setSocialLoading(true);
    setSocialError(null);
    setHasSocialSearched(true);
    try {
      if (socialSearchPlatform === 'linkedin') {
        const response = await miyagiAPI.post('/linkedin-search-profiles', {
          name: socialSearchQuery,
        });
        if (response.success && response.data && response.data.profiles) {
          setSocialResults(response.data.profiles.map((profile, idx) => ({
            ...profile,
            id: profile.link || `linkedin-${profile.name}-${idx}`,
            platform: 'linkedin',
          })));
        } else {
          setSocialError(response.error || 'Failed to search LinkedIn profiles');
          setSocialResults([]);
        }
      } else if (socialSearchPlatform === 'youtube') {
        const response = await miyagiAPI.post('/youtube-search', {
          q: socialSearchQuery,
          maxResults: 20,
        });
        if (response.success && response.data && response.data.videos) {
          setSocialResults(response.data.videos.map((video, idx) => ({
            ...video,
            id: video.id?.videoId || video.id || `video-${idx}`,
            platform: 'youtube',
          })));
        } else {
          const errorMsg = response.error || response.message || 'Failed to search YouTube';
          setSocialError(`YouTube Error: ${errorMsg}. The DeepSpace YouTube integration may need configuration.`);
          setSocialResults([]);
        }
      }
    } catch (error) {
      console.error('Error searching social:', error);
      const errorMessage = error.message || error.toString();
      if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
        setSocialError('YouTube API Error (400): Bad Request. Your YOUTUBE_API_KEY may be missing or invalid. Check your environment variables and ensure the key is set correctly.');
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        setSocialError('YouTube API Error (403): Access Forbidden. Your API key may have incorrect restrictions. In Google Cloud Console → Credentials → API Key, set "Application restrictions" to "None" or "IP addresses" (not HTTP referrers, which block server requests).');
      } else if (errorMessage.includes('429')) {
        setSocialError('YouTube API Error (429): Quota exceeded. You have hit the daily API quota limit. Try again tomorrow or request a quota increase in Google Cloud Console.');
      } else {
        setSocialError(`Error: ${errorMessage}`);
      }
      setSocialResults([]);
    } finally {
      setSocialLoading(false);
    }
  };

  const followAccount = (account) => {
    const isFollowing = followedAccounts.some(
      (acc) => (acc.id === account.id || acc.id === account.snippet?.channelId) && acc.platform === account.platform
    );
    if (!isFollowing) {
      setFollowedAccounts((prev) => [...(prev || []), account]);
    }
  };

  const unfollowAccount = (accountId, platform) => {
    setFollowedAccounts((prev) =>
      (prev || []).filter(
        (acc) => !(acc.id === accountId && acc.platform === platform)
      )
    );
  };

  const searchWatchlistStocks = async () => {
    if (!watchlistSearchQuery.trim()) return;
    setWatchlistSearching(true);
    setWatchlistSearchError(null);
    setHasSearched(true);
    try {
      const response = await miyagiAPI.post('/search-stocks', {
        term: watchlistSearchQuery,
        query: watchlistSearchQuery,
      });
      if (response && response.success && response.data) {
        const list = Array.isArray(response.data.symbols) ? response.data.symbols : [];
        setWatchlistSearchResults(list);
      } else {
        setWatchlistSearchResults([]);
        setWatchlistSearchError((response && response.error) || 'Search failed. Check ALPHA_VANTAGE_KEY in .env.');
      }
    } catch (error) {
      console.error('Error searching stocks:', error);
      setWatchlistSearchResults([]);
      setWatchlistSearchError((error && error.message) || 'Search failed. Check your connection.');
    } finally {
      setWatchlistSearching(false);
    }
  };

  const getQuoteForResult = async (symbol) => {
    setLoadingWatchlistQuotes((prev) => ({ ...prev, [symbol]: true }));
    try {
      const mockQuote = {
        symbol,
        price: (Math.random() * 500 + 50).toFixed(2),
        change: (Math.random() * 20 - 10).toFixed(2),
        changePercent: (Math.random() * 10 - 5).toFixed(2),
        volume: Math.floor(Math.random() * 10000000),
        latestTradingDay: new Date().toISOString().split('T')[0],
      };
      setWatchlistQuotes((prev) => ({ ...prev, [symbol]: mockQuote }));
    } catch (error) {
      console.error('Error getting quote:', error);
    } finally {
      setLoadingWatchlistQuotes((prev) => ({ ...prev, [symbol]: false }));
    }
  };

  const addToWatchlistFromSearch = (symbol) => {
    const upperSymbol = symbol.toUpperCase();
    if (!watchlist.includes(upperSymbol)) {
      setWatchlist((prev) => [...(prev || []), upperSymbol]);
    }
  };

  const addTickerToWatchlist = async () => {
    if (!newTickerInput.trim()) return;
    const ticker = newTickerInput.trim().toUpperCase();
    if (watchlist.includes(ticker)) {
      alert(`${ticker} is already in your watchlist.`);
      return;
    }
    try {
      const response = await miyagiAPI.post('/search-stocks', {
        term: ticker,
      });
      if (response.success && response.data && response.data.symbols && response.data.symbols.length > 0) {
        setWatchlist((prev) => [...(prev || []), ticker]);
        setNewTickerInput('');
      } else {
        const confirmAdd = window.confirm(`Could not verify ticker ${ticker}. Add anyway?`);
        if (confirmAdd) {
          setWatchlist((prev) => [...(prev || []), ticker]);
          setNewTickerInput('');
        }
      }
    } catch (error) {
      console.error('Error adding ticker:', error);
      setWatchlist((prev) => [...(prev || []), ticker]);
      setNewTickerInput('');
    }
  };

  const refreshWatchlistQuote = async (ticker) => {
    setLoadingWatchlistQuotes((prev) => ({ ...prev, [ticker]: true }));
    try {
      const mockQuote = {
        symbol: ticker,
        price: (Math.random() * 500 + 50).toFixed(2),
        change: (Math.random() * 20 - 10).toFixed(2),
        changePercent: (Math.random() * 10 - 5).toFixed(2),
        volume: Math.floor(Math.random() * 10000000),
        latestTradingDay: new Date().toISOString().split('T')[0],
      };
      setWatchlistQuotes((prev) => ({ ...prev, [ticker]: mockQuote }));
    } catch (error) {
      console.error('Error refreshing quote:', error);
    } finally {
      setLoadingWatchlistQuotes((prev) => ({ ...prev, [ticker]: false }));
    }
  };

  const searchPortfolioTicker = async () => {
    if (!portfolioSearchQuery.trim()) return;
    setPortfolioSearching(true);
    setPortfolioSearchError(null);
    setPortfolioHasSearched(true);
    try {
      const response = await miyagiAPI.post('/search-stocks', {
        term: portfolioSearchQuery,
        query: portfolioSearchQuery,
      });
      if (response && response.success && response.data) {
        const list = Array.isArray(response.data.symbols) ? response.data.symbols : [];
        setPortfolioSearchResults(list);
      } else {
        setPortfolioSearchResults([]);
        setPortfolioSearchError((response && response.error) || 'Search failed. Check ALPHA_VANTAGE_KEY in .env.');
      }
    } catch (error) {
      console.error('Error searching stocks:', error);
      setPortfolioSearchResults([]);
      setPortfolioSearchError((error && error.message) || 'Search failed. Check your connection.');
    } finally {
      setPortfolioSearching(false);
    }
  };

  const addTickerToPortfolio = (ticker) => {
    if (!watchlist.includes(ticker)) {
      setWatchlist((prev) => [...(prev || []), ticker]);
    }
    setPortfolioSearchQuery('');
    setPortfolioSearchResults([]);
  };

  const addPosition = (ticker, quantity, entryPrice) => {
    const tickerUpper = ticker.toUpperCase();
    setPositions((prev) => ({
      ...(prev || {}),
      [tickerUpper]: {
        quantity: parseFloat(quantity),
        entryPrice: parseFloat(entryPrice),
        currentPrice: parseFloat(entryPrice),
        notes: (tickerNotes || {})[tickerUpper] || '',
      },
    }));
    setEditingPosition(null);
    setEditingPositionData({});
  };

  const updatePosition = (ticker, updates) => {
    setPositions((prev) => ({
      ...(prev || {}),
      [ticker]: {
        ...((prev || {})[ticker] || {}),
        ...updates,
      },
    }));
  };

  const deletePosition = (ticker) => {
    if (window.confirm(`Remove position for ${ticker}?`)) {
      setPositions((prev) => {
        const newPositions = { ...(prev || {}) };
        delete newPositions[ticker];
        return newPositions;
      });
    }
  };

  const refreshQuote = async (ticker) => {
    setRefreshingQuotes((prev) => ({ ...prev, [ticker]: true }));
    try {
      const response = await miyagiAPI.post('/search-stocks', {
        term: ticker,
      });
      if (response.success && response.data && response.data.symbols && response.data.symbols.length > 0) {
        const mockCurrentPrice = (positions || {})[ticker]?.entryPrice * (1 + (Math.random() * 0.2 - 0.1));
        updatePosition(ticker, { currentPrice: mockCurrentPrice });
      }
    } catch (error) {
      console.error('Error refreshing quote:', error);
    } finally {
      setRefreshingQuotes((prev) => ({ ...prev, [ticker]: false }));
    }
  };

  const updateTickerNotes = (ticker, notes) => {
    setTickerNotes((prev) => ({
      ...(prev || {}),
      [ticker]: notes,
    }));
  };

  const emailDigest = async () => {
    if (!digest) return;
    setEmailLoading(true);
    try {
      await miyagiAPI.post('/send-email', {
        to: 'user@example.com',
        subject: `Daily Market Digest - ${digest.date}`,
        html: `<h1>Daily Market Digest</h1><p><strong>Date:</strong> ${digest.date}</p><div style="white-space: pre-wrap;">${digest.content}</div>`,
      });
      alert('Digest sent to email!');
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Error sending email. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  const filteredNews = useMemo(() => {
    let filtered = news;
    if (selectedCatalysts.length > 0) {
      filtered = filtered.filter((article) =>
        article.catalysts?.some((cat) => selectedCatalysts.includes(cat))
      );
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((article) =>
        article.title?.toLowerCase().includes(query) ||
        article.description?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [news, selectedCatalysts, searchQuery]);

  const clusteredNews = useMemo(() => clusterStories(filteredNews), [filteredNews]);

  const stats = useMemo(() => ({
    totalStories: news.length,
    watchlistSize: watchlist.length,
    alertsCount: alerts.length,
    catalystsFound: new Set(news.flatMap((n) => n.catalysts || [])).size,
  }), [news, watchlist, alerts]);

  // Force localhost look inside Deep Space: isolate from host theme and lock light styles
  const rootWrapStyle = {
    backgroundColor: '#ffffff',
    color: '#000000',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif',
    minHeight: '100%',
    width: '100%',
    isolation: 'isolate',
    overflow: 'auto',
  };

  const styles = {
    container: {
      display: 'flex',
      height: '100vh',
      minHeight: '600px',
      backgroundColor: '#ffffff',
      color: '#000000',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif',
      overflow: 'hidden',
    },
    sidebar: {
      width: '280px',
      borderRight: '1px solid #f0f0f0',
      padding: '32px 24px',
      overflowY: 'auto',
      backgroundColor: '#ffffff',
    },
    mainContent: {
      flex: 1,
      overflowY: 'auto',
      padding: '40px',
      backgroundColor: '#ffffff',
    },
    navButton: (isActive) => ({
      width: '100%',
      padding: '14px 16px',
      marginBottom: '8px',
      border: 'none',
      borderRadius: '10px',
      backgroundColor: isActive ? '#6366f1' : 'transparent',
      color: isActive ? '#ffffff' : '#000000',
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: '15px',
      fontWeight: isActive ? '600' : '400',
      transition: 'all 0.2s',
    }),
    card: {
      padding: '32px',
      backgroundColor: '#ffffff',
      border: '1px solid #f0f0f0',
      borderRadius: '16px',
      marginBottom: '24px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
    },
    input: {
      width: '100%',
      padding: '14px 18px',
      border: '1px solid #f0f0f0',
      borderRadius: '12px',
      fontSize: '15px',
      backgroundColor: '#ffffff',
      color: '#000000',
      outline: 'none',
      transition: 'border-color 0.2s',
    },
    button: (variant = 'primary') => ({
      padding: '12px 24px',
      backgroundColor: variant === 'primary' ? '#6366f1' : variant === 'danger' ? '#ef4444' : 'transparent',
      color: variant === 'primary' || variant === 'danger' ? '#ffffff' : '#000000',
      border: variant === 'ghost' ? '1px solid #f0f0f0' : 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontSize: '15px',
      fontWeight: '500',
      transition: 'all 0.2s',
    }),
  };

  return (
    <div id="financial-command-center-root" style={rootWrapStyle}>
      <style>{`
        #financial-command-center-root, #financial-command-center-root * { box-sizing: border-box; }
        #financial-command-center-root { background: #ffffff !important; color: #000000 !important; }
      `}</style>
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            Command Center
          </h1>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>Financial market intelligence</p>
        </div>

        <nav style={{ marginBottom: '32px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'watchlist', label: 'Watchlist' },
            { id: 'alerts', label: 'Alerts' },
            { id: 'ticker', label: 'Ticker Detail' },
            { id: 'digest', label: 'Digest' },
            { id: 'social', label: 'Social' },
            { id: 'portfolio', label: 'Portfolio' },
            { id: 'sectors', label: 'Sectors' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              style={styles.navButton(activeView === item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{
          padding: '20px',
          backgroundColor: '#fafafa',
          borderRadius: '12px',
          marginBottom: '32px',
        }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px', fontWeight: '500' }}>
            Real-Time Stats
          </div>
          <div style={{ fontSize: '13px', lineHeight: '2' }}>
            <div>Stories: <strong>{stats.totalStories}</strong></div>
            <div>Watchlist: <strong>{stats.watchlistSize}</strong></div>
            <div>Alerts: <strong>{stats.alertsCount}</strong></div>
            <div>Catalysts: <strong>{stats.catalystsFound}</strong></div>
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px', color: '#000' }}>
            Sectors ({SECTORS.length + (customSectors || []).length})
          </div>
          {[...SECTORS, ...(customSectors || [])].slice(0, 5).map((sector) => (
            <label key={sector.id} style={{ display: 'block', marginBottom: '12px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedSectors.includes(sector.id)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedSectors((prev) => [...prev, sector.id]);
                  else setSelectedSectors((prev) => prev.filter((s) => s !== sector.id));
                }}
                style={{ marginRight: '10px' }}
              />
              {sector.name}
              {sector.custom && <span style={{ fontSize: '11px', color: '#6366f1', marginLeft: '6px' }}>(Custom)</span>}
            </label>
          ))}
          {(customSectors || []).length + SECTORS.length > 5 && (
            <button
              onClick={() => setActiveView('sectors')}
              style={{
                marginTop: '12px',
                fontSize: '13px',
                color: '#6366f1',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              View All →
            </button>
          )}
        </div>

        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px', color: '#000' }}>
            Catalysts
          </div>
          {CATALYSTS.map((catalyst) => (
            <label key={catalyst.id} style={{ display: 'block', marginBottom: '12px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedCatalysts.includes(catalyst.id)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedCatalysts((prev) => [...prev, catalyst.id]);
                  else setSelectedCatalysts((prev) => prev.filter((c) => c !== catalyst.id));
                }}
                style={{ marginRight: '10px' }}
              />
              <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: catalyst.color, borderRadius: 1, marginRight: 6, verticalAlign: 'middle' }} aria-hidden /> {catalyst.name}
            </label>
          ))}
        </div>

        {deepSpace && (
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#000' }}>Backend URL</div>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
              Set your deployed Stock Tracker URL so Social, Digest, Portfolio search, and stock search work.
            </p>
            <input
              type="text"
              placeholder="https://your-app.vercel.app"
              value={backendUrl}
              onChange={(e) => { setBackendUrl(e.target.value); setBackendUrlSaved(false); }}
              style={{ ...styles.input, padding: '10px 12px', fontSize: '13px', marginBottom: '8px' }}
            />
            <button
              type="button"
              onClick={() => {
                const url = (backendUrl || '').trim().replace(/\/$/, '');
                if (url && typeof localStorage !== 'undefined') {
                  localStorage.setItem('financial.commandCenter.apiBase', url);
                  setBackendUrl(url);
                  setBackendUrlSaved(true);
                  setTimeout(() => setBackendUrlSaved(false), 2000);
                }
              }}
              style={{ ...styles.button('primary'), padding: '8px 16px', fontSize: '13px' }}
            >
              {backendUrlSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div style={styles.mainContent}>
        {(activeView === 'dashboard' || activeView === 'alerts') && (
          <div style={{ marginBottom: '32px' }}>
            <input
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.input}
            />
          </div>
        )}

        {activeView === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Market Dashboard</h2>
              <button
                onClick={loadNews}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {loading && (news || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Loading news...</div>
            ) : newsError ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#b91c1c' }}>
                <p style={{ marginBottom: '12px' }}>{newsError}</p>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>Ensure NEWS_API_KEY is set in .env for the news API.</p>
                <button
                  onClick={loadNews}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (clusteredNews || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No news found. Try adjusting filters or click Refresh.</div>
            ) : (
              <div>
                {(clusteredNews || []).map((cluster, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: '24px',
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      border: `1px solid ${'#f0f0f0'}`,
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600' }}>
                        {(cluster.key || '').charAt(0).toUpperCase() + (cluster.key || '').slice(1)} ({cluster.size || 0} stories)
                      </h3>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(cluster.topCatalysts || []).map((catId) => {
                          const cat = (CATALYSTS || []).find((c) => c.id === catId);
                          return cat ? (
                            <span
                              key={catId}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: (cat.color || '') + '20',
                                color: cat.color,
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500',
                              }}
                            >
                              {cat.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                      {(cluster.stories || []).slice(0, 6).map((article, aidx) => (
                        <a
                          key={aidx}
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '16px',
                            backgroundColor: '#f9fafb',
                            border: `1px solid ${'#f0f0f0'}`,
                            borderRadius: '8px',
                            textDecoration: 'none',
                            color: '#000000',
                            display: 'block',
                            transition: 'transform 0.2s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', lineHeight: '1.4' }}>{article.title}</div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                            {(article.source && article.source.name) || 'Unknown'} • {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ''}
                          </div>
                          {article.catalysts && article.catalysts.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {article.catalysts.map((catId) => {
                                const cat = (CATALYSTS || []).find((c) => c.id === catId);
                                return cat ? (
                                  <span
                                    key={catId}
                                    style={{
                                      padding: '2px 6px',
                                      backgroundColor: (cat.color || '') + '20',
                                      color: cat.color,
                                      borderRadius: '3px',
                                      fontSize: '10px',
                                    }}
                                  >
                                    {cat.name}
                                  </span>
                                ) : null;
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
        )}

        {activeView === 'watchlist' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Watchlist</h2>
            <div
              style={{
                padding: '20px',
                backgroundColor: '#ffffff',
                border: `1px solid ${'#f0f0f0'}`,
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Search Stocks</div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Search by symbol or company name"
                  value={watchlistSearchQuery}
                  onChange={(e) => setWatchlistSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchWatchlistStocks()}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: `1px solid ${'#f0f0f0'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                  }}
                />
                <button
                  onClick={searchWatchlistStocks}
                  disabled={watchlistSearching || !watchlistSearchQuery.trim()}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: watchlistSearching ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {watchlistSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
              {watchlistSearchError && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                  {watchlistSearchError}
                </div>
              )}
              {!watchlistSearchError && watchlistSearchResults && watchlistSearchResults.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Results — click Add to watchlist</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {watchlistSearchResults.map((result) => {
                      const symbol = (result && result.symbol) || (typeof result === 'string' ? result : '');
                      if (!symbol) return null;
                      return (
                        <div
                          key={symbol}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px',
                            border: '1px solid #f0f0f0',
                          }}
                        >
                          <span style={{ fontWeight: '600', fontSize: '14px' }}>{symbol}</span>
                          {result.name && <span style={{ fontSize: '12px', color: '#666' }}>{result.name}</span>}
                          <button
                            onClick={() => addToWatchlistFromSearch(symbol)}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                            }}
                          >
                            Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!watchlistSearchError && hasSearched && !watchlistSearching && watchlistSearchResults.length === 0 && (
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>No matches found. Try a symbol (e.g. AAPL) or company name.</div>
              )}
            </div>
            <div
              style={{
                padding: '20px',
                backgroundColor: '#ffffff',
                border: `1px solid ${'#f0f0f0'}`,
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Add Ticker (manual)</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Enter ticker symbol (e.g., AAPL, TSLA)"
                  value={newTickerInput}
                  onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && addTickerToWatchlist()}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: `1px solid ${'#f0f0f0'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                  }}
                />
                <button
                  onClick={addTickerToWatchlist}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {(watchlist || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No tickers in watchlist. Add some above!</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                {(watchlist || []).map((ticker) => (
                  <div
                    key={ticker}
                    style={{
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      border: `1px solid ${'#f0f0f0'}`,
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600' }}>{ticker}</div>
                      <button
                        onClick={() => setWatchlist((watchlist || []).filter((t) => t !== ticker))}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <button
                      onClick={() => briefTicker(ticker)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#6366f1',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        marginTop: '8px',
                      }}
                    >
                      {loading && selectedTicker === ticker ? 'Loading...' : 'Brief Me'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'alerts' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Alerts</h2>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Last checked: {lastAlertCheck ? new Date(lastAlertCheck).toLocaleString() : 'Never'}
              </div>
            </div>
            <button
              onClick={checkAlerts}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6366f1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '24px',
              }}
            >
              {loading ? 'Checking...' : 'Check Alerts'}
            </button>

            {(watchlist || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                <p style={{ marginBottom: '16px' }}>Add tickers to your watchlist to see news alerts.</p>
                <button
                  onClick={() => setActiveView('watchlist')}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Go to Watchlist
                </button>
              </div>
            ) : (alerts || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                No alerts. Your watchlist stocks haven't been mentioned recently.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {(alerts || []).map((article, idx) => (
                  <a
                    key={idx}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      border: `1px solid ${'#f0f0f0'}`,
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                      textDecoration: 'none',
                      color: '#000000',
                      display: 'block',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', lineHeight: '1.4' }}>{article.title}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                      {(article.source && article.source.name) || 'Unknown'} • {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ''}
                    </div>
                    {article.catalysts && article.catalysts.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {article.catalysts.map((catId) => {
                          const cat = (CATALYSTS || []).find((c) => c.id === catId);
                          return cat ? (
                            <span
                              key={catId}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: (cat.color || '') + '20',
                                color: cat.color,
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500',
                              }}
                            >
                              {cat.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'ticker' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Ticker Detail</h2>
            {!tickerBrief ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                <p style={{ marginBottom: '16px' }}>Select a ticker from Watchlist and click "Brief Me" to see details.</p>
                {(watchlist || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                    {(watchlist || []).map((t) => (
                      <button
                        key={t}
                        onClick={() => briefTicker(t)}
                        disabled={loading}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#6366f1',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                        }}
                      >
                        {loading && selectedTicker === t ? 'Loading...' : t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div
                  style={{
                    padding: '24px',
                    backgroundColor: '#ffffff',
                    border: `1px solid ${'#f0f0f0'}`,
                    borderRadius: '12px',
                    marginBottom: '24px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>{tickerBrief.ticker} - Executive Brief</h3>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: '24px' }}>{tickerBrief.summary}</div>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Forecast Scenarios</h4>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{tickerBrief.forecast}</div>
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Recent News</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {(tickerBrief.news || []).map((article, idx) => (
                      <a
                        key={idx}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '16px',
                          backgroundColor: '#f9fafb',
                          border: `1px solid ${'#f0f0f0'}`,
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: '#000000',
                          display: 'block',
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>{article.title}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {(article.source && article.source.name) || 'Unknown'} • {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ''}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'digest' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Daily Digest</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={generateDigest}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {loading ? 'Generating...' : 'Generate Digest'}
                </button>
                {digest && (
                  <>
                    <button
                      onClick={emailDigest}
                      disabled={emailLoading}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: emailLoading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                      }}
                    >
                      {emailLoading ? 'Sending...' : 'Email'}
                    </button>
                    <button
                      onClick={exportToPDF}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#f59e0b',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                      }}
                    >
                      Export PDF
                    </button>
                  </>
                )}
              </div>
            </div>

            {!digest ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                Click "Generate Digest" to create a daily market summary.
              </div>
            ) : (
              <div
                id="digest-content"
                style={{
                  padding: '32px',
                  backgroundColor: '#ffffff',
                  border: `1px solid ${'#f0f0f0'}`,
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${'#f0f0f0'}` }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Daily Market Digest</h3>
                  <div style={{ fontSize: '14px', color: '#666' }}>{digest.date}</div>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '15px', marginBottom: '32px' }}>{digest.content}</div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Key Articles</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                    {(digest.articles || []).map((article, idx) => (
                      <a
                        key={idx}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '12px',
                          backgroundColor: '#f9fafb',
                          border: `1px solid ${'#f0f0f0'}`,
                          borderRadius: '6px',
                          textDecoration: 'none',
                          color: '#000000',
                          fontSize: '13px',
                        }}
                      >
                        {article.title}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'social' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Social Tracking</h2>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <button
                onClick={() => setSocialSearchPlatform('linkedin')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: socialSearchPlatform === 'linkedin' ? '#6366f1' : 'transparent',
                  color: socialSearchPlatform === 'linkedin' ? '#ffffff' : '#000000',
                  border: `1px solid ${'#f0f0f0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                LinkedIn
              </button>
              <button
                onClick={() => setSocialSearchPlatform('youtube')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: socialSearchPlatform === 'youtube' ? '#6366f1' : 'transparent',
                  color: socialSearchPlatform === 'youtube' ? '#ffffff' : '#000000',
                  border: `1px solid ${'#f0f0f0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                YouTube
              </button>
            </div>

            <div
              style={{
                padding: '20px',
                backgroundColor: '#ffffff',
                border: `1px solid ${'#f0f0f0'}`,
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder={socialSearchPlatform === 'linkedin' ? 'Search LinkedIn profiles...' : 'Search YouTube channels/videos...'}
                  value={socialSearchQuery}
                  onChange={(e) => setSocialSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchSocial()}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: `1px solid ${'#f0f0f0'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                  }}
                />
                <button
                  onClick={searchSocial}
                  disabled={socialLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: socialLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {socialLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {followedAccounts && followedAccounts.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Following ({followedAccounts.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                  {followedAccounts.map((account, idx) => {
                    const isLinkedIn = account.platform === 'linkedin';
                    const linkUrl = isLinkedIn
                      ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(account.name || account.headline || '')}`
                      : account.videoId
                        ? `https://www.youtube.com/watch?v=${account.videoId}`
                        : (account.channelId || (account.snippet && account.snippet.channelId))
                          ? `https://www.youtube.com/channel/${account.channelId || account.snippet.channelId}`
                          : `https://www.youtube.com/results?search_query=${encodeURIComponent((account.snippet && account.snippet.title) || account.title || '')}`;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '16px',
                          backgroundColor: '#ffffff',
                          border: `1px solid ${'#f0f0f0'}`,
                          borderRadius: '12px',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <a
                              href={linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#6366f1',
                                textDecoration: 'none',
                                display: 'block',
                                marginBottom: '4px',
                              }}
                            >
                              {account.name || (account.snippet && account.snippet.title) || account.title || 'Unknown'}
                            </a>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {isLinkedIn ? account.headline : (account.snippet && account.snippet.channelTitle)}
                            </div>
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: '8px',
                                padding: '4px 8px',
                                backgroundColor: isLinkedIn ? '#0077b5' : '#ff0000',
                                color: '#ffffff',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '500',
                              }}
                            >
                              {isLinkedIn ? 'LinkedIn' : 'YouTube'}
                            </span>
                          </div>
                          <button
                            onClick={() => unfollowAccount(account.id || account.channelId || (account.snippet && account.snippet.channelId), account.platform)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            Unfollow
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {socialResults && socialResults.length > 0 && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Search Results</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                  {socialResults.map((result, idx) => {
                    const isLinkedIn = result.platform === 'linkedin';
                    const isFollowing = (followedAccounts || []).some((acc) => acc.id === result.id && acc.platform === result.platform);
                    const linkUrl = isLinkedIn
                      ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(result.name || result.headline || socialSearchQuery)}`
                      : result.videoId
                        ? `https://www.youtube.com/watch?v=${result.videoId}`
                        : (result.channelId || (result.snippet && result.snippet.channelId))
                          ? `https://www.youtube.com/channel/${result.channelId || result.snippet.channelId}`
                          : `https://www.youtube.com/results?search_query=${encodeURIComponent((result.snippet && result.snippet.title) || result.title || socialSearchQuery)}`;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '16px',
                          backgroundColor: '#ffffff',
                          border: `1px solid ${'#f0f0f0'}`,
                          borderRadius: '12px',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <div style={{ marginBottom: '12px' }}>
                          <a
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#6366f1',
                              textDecoration: 'none',
                              display: 'block',
                              marginBottom: '4px',
                            }}
                          >
                            {result.name || (result.snippet && result.snippet.title) || result.title || 'Unknown'}
                          </a>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                            {isLinkedIn ? result.headline : (result.snippet && result.snippet.channelTitle) || (result.snippet && result.snippet.description)}
                          </div>
                          {isLinkedIn && result.location && (
                            <div style={{ fontSize: '11px', color: '#999' }}>{result.location}</div>
                          )}
                          {!isLinkedIn && result.snippet && result.snippet.publishedAt && (
                            <div style={{ fontSize: '11px', color: '#999' }}>
                              {new Date(result.snippet.publishedAt).toLocaleDateString()}
                            </div>
                          )}
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: '8px',
                              padding: '4px 8px',
                              backgroundColor: isLinkedIn ? '#0077b5' : '#ff0000',
                              color: '#ffffff',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '500',
                            }}
                          >
                            {isLinkedIn ? 'LinkedIn' : 'YouTube'}
                          </span>
                        </div>
                        <button
                          onClick={() => (isFollowing ? unfollowAccount(result.id || result.channelId || (result.snippet && result.snippet.channelId), result.platform) : followAccount(result))}
                          style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: isFollowing ? '#ef4444' : '#6366f1',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                          }}
                        >
                          {isFollowing ? 'Following' : '+ Follow'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!socialLoading && (!socialResults || socialResults.length === 0) && socialSearchQuery && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No results found. Try a different search query.</div>
            )}
          </div>
        )}

        {activeView === 'portfolio' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Portfolio</h2>
            <div
              style={{
                padding: '20px',
                backgroundColor: '#ffffff',
                border: `1px solid ${'#f0f0f0'}`,
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Search Stocks</div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Search by symbol or company name"
                  value={portfolioSearchQuery}
                  onChange={(e) => setPortfolioSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchPortfolioTicker()}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: `1px solid ${'#f0f0f0'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                  }}
                />
                <button
                  onClick={searchPortfolioTicker}
                  disabled={portfolioSearching || !portfolioSearchQuery.trim()}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: portfolioSearching ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {portfolioSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
              {portfolioSearchError && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                  {portfolioSearchError}
                </div>
              )}
              {!portfolioSearchError && portfolioSearchResults && portfolioSearchResults.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Results — click Add to track</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {portfolioSearchResults.map((result) => {
                      const symbol = (result && result.symbol) || (typeof result === 'string' ? result : '');
                      if (!symbol) return null;
                      return (
                        <div
                          key={symbol}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px',
                            border: '1px solid #f0f0f0',
                          }}
                        >
                          <span style={{ fontWeight: '600', fontSize: '14px' }}>{symbol}</span>
                          {result.name && <span style={{ fontSize: '12px', color: '#666' }}>{result.name}</span>}
                          <button
                            onClick={() => addTickerToPortfolio(symbol)}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                            }}
                          >
                            Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!portfolioSearchError && portfolioHasSearched && !portfolioSearching && portfolioSearchResults.length === 0 && (
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>No matches found. Try a symbol (e.g. AAPL) or company name.</div>
              )}
            </div>
            <div
              style={{
                padding: '20px',
                backgroundColor: '#ffffff',
                border: `1px solid ${'#f0f0f0'}`,
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Track Stock (manual)</div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                Or enter a ticker symbol directly to track.
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Enter ticker symbol (e.g., AAPL, TSLA)"
                  value={newTickerInput}
                  onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && addTickerToWatchlist()}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: `1px solid ${'#f0f0f0'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                  }}
                />
                <button
                  onClick={addTickerToWatchlist}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Track Stock
                </button>
              </div>
            </div>

            {Object.keys(positions || {}).length === 0 && (watchlist || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No positions tracked. Add stocks above to get started!</div>
            ) : (
              <div>
                {Object.keys(positions || {}).length > 0 && (
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      border: `1px solid ${'#f0f0f0'}`,
                      borderRadius: '12px',
                      marginBottom: '24px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Portfolio Summary</h3>
                    {(() => {
                      const pos = positions || {};
                      const totalCost = Object.values(pos).reduce((sum, p) => sum + (p.costBasis || (p.quantity || 0) * (p.entryPrice || 0)), 0);
                      const totalValue = Object.values(pos).reduce((sum, p) => sum + (p.currentValue || (p.quantity || 0) * (p.currentPrice || p.entryPrice || 0)), 0);
                      const totalPL = totalValue - totalCost;
                      const totalPLPercent = totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(2) : 0;
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Total Cost</div>
                            <div style={{ fontSize: '20px', fontWeight: '600' }}>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Current Value</div>
                            <div style={{ fontSize: '20px', fontWeight: '600' }}>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>P&L</div>
                            <div style={{ fontSize: '20px', fontWeight: '600', color: totalPL >= 0 ? '#10b981' : '#ef4444' }}>
                              ${totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalPLPercent}%)
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {[...new Set([...(watchlist || []), ...Object.keys(positions || {})])].map((ticker) => {
                    const position = (positions || {})[ticker] || {};
                    const notes = (tickerNotes || {})[ticker] || '';
                    const costBasis = (position.quantity || 0) * (position.entryPrice || 0);
                    const currentValue = (position.quantity || 0) * (position.currentPrice || position.entryPrice || 0);
                    const pl = currentValue - costBasis;
                    const plPercent = costBasis > 0 ? ((pl / costBasis) * 100).toFixed(2) : 0;

                    return (
                      <div
                        key={ticker}
                        style={{
                          padding: '20px',
                          backgroundColor: '#ffffff',
                          border: `1px solid ${'#f0f0f0'}`,
                          borderRadius: '12px',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <div style={{ fontSize: '20px', fontWeight: '600' }}>{ticker}</div>
                          <button
                            onClick={() => {
                              if (typeof window !== 'undefined' && window.confirm && window.confirm(`Remove ${ticker} from tracking?`)) {
                                setWatchlist((watchlist || []).filter((t) => t !== ticker));
                                deletePosition(ticker);
                              }
                            }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Remove
                          </button>
                        </div>

                        {editingPosition === ticker ? (
                          <div>
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Quantity</label>
                              <input
                                type="number"
                                value={position.quantity || ''}
                                onChange={(e) => updatePosition(ticker, { ...position, quantity: parseFloat(e.target.value) || 0 })}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: `1px solid ${'#f0f0f0'}`,
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  backgroundColor: '#ffffff',
                                  color: '#000000',
                                }}
                              />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Entry Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={position.entryPrice || ''}
                                onChange={(e) => updatePosition(ticker, { ...position, entryPrice: parseFloat(e.target.value) || 0 })}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: `1px solid ${'#f0f0f0'}`,
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  backgroundColor: '#ffffff',
                                  color: '#000000',
                                }}
                              />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Current Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={position.currentPrice || ''}
                                onChange={(e) => updatePosition(ticker, { ...position, currentPrice: parseFloat(e.target.value) || 0 })}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: `1px solid ${'#f0f0f0'}`,
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  backgroundColor: '#ffffff',
                                  color: '#000000',
                                }}
                              />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Target Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={position.targetPrice || ''}
                                onChange={(e) => updatePosition(ticker, { ...position, targetPrice: parseFloat(e.target.value) || 0 })}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: `1px solid ${'#f0f0f0'}`,
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  backgroundColor: '#ffffff',
                                  color: '#000000',
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => {
                                  updatePosition(ticker, {
                                    ...position,
                                    costBasis: (position.quantity || 0) * (position.entryPrice || 0),
                                    currentValue: (position.quantity || 0) * (position.currentPrice || position.entryPrice || 0),
                                  });
                                  setEditingPosition(null);
                                }}
                                style={{
                                  flex: 1,
                                  padding: '8px',
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingPosition(null)}
                                style={{
                                  flex: 1,
                                  padding: '8px',
                                  backgroundColor: '#f0f0f0',
                                  color: '#000000',
                                  border: `1px solid ${'#f0f0f0'}`,
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {position.quantity ? (
                              <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
                                  <div>
                                    <div style={{ color: '#666' }}>Quantity</div>
                                    <div style={{ fontWeight: '600' }}>{position.quantity}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: '#666' }}>Entry</div>
                                    <div style={{ fontWeight: '600' }}>${(position.entryPrice != null && position.entryPrice !== '') ? Number(position.entryPrice).toFixed(2) : '0.00'}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: '#666' }}>Current</div>
                                    <div style={{ fontWeight: '600' }}>${(position.currentPrice != null && position.currentPrice !== '') ? Number(position.currentPrice).toFixed(2) : (position.entryPrice != null ? Number(position.entryPrice).toFixed(2) : '0.00')}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: '#666' }}>Target</div>
                                    <div style={{ fontWeight: '600' }}>${(position.targetPrice != null && position.targetPrice !== '') ? Number(position.targetPrice).toFixed(2) : 'N/A'}</div>
                                  </div>
                                </div>
                                <div
                                  style={{
                                    padding: '12px',
                                    backgroundColor: '#f9fafb',
                                    borderRadius: '8px',
                                    marginTop: '12px',
                                  }}
                                >
                                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>P&L</div>
                                  <div style={{ fontSize: '18px', fontWeight: '600', color: pl >= 0 ? '#10b981' : '#ef4444' }}>
                                    ${Number(pl).toFixed(2)} ({plPercent}%)
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginBottom: '16px', fontSize: '13px', color: '#666' }}>No position data. Click "Edit Position" to add.</div>
                            )}

                            <button
                              onClick={() => setEditingPosition(ticker)}
                              style={{
                                width: '100%',
                                padding: '10px',
                                backgroundColor: '#6366f1',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                marginBottom: '12px',
                              }}
                            >
                              {position.quantity ? 'Edit Position' : 'Add Position'}
                            </button>

                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>Notes</div>
                              <textarea
                                value={notes}
                                onChange={(e) => setTickerNotes({ ...(tickerNotes || {}), [ticker]: e.target.value })}
                                placeholder="Add notes about this stock..."
                                style={{
                                  width: '100%',
                                  minHeight: '80px',
                                  padding: '8px',
                                  border: `1px solid ${'#f0f0f0'}`,
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  backgroundColor: '#ffffff',
                                  color: '#000000',
                                  resize: 'vertical',
                                  fontFamily: 'inherit',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'sectors' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Sectors</h2>
            </div>

            <div
              style={{
                padding: '20px',
                backgroundColor: '#ffffff',
                border: '1px solid #f0f0f0',
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Add Custom Sector</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Sector name</label>
                  <input
                    type="text"
                    placeholder="e.g. Crypto"
                    value={newSectorName}
                    onChange={(e) => setNewSectorName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #f0f0f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                    }}
                  />
                </div>
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Keywords (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. bitcoin, ethereum, crypto"
                    value={newSectorKeywords}
                    onChange={(e) => setNewSectorKeywords(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #f0f0f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                    }}
                  />
                </div>
                <button
                  onClick={addCustomSector}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Add Custom Sector
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
              {[...(SECTORS || []), ...(customSectors || [])].map((sector) => (
                <div
                  key={sector.id}
                  style={{
                    padding: '20px',
                    backgroundColor: '#ffffff',
                    border: `1px solid ${'#f0f0f0'}`,
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
                        {sector.name}
                        {sector.custom && <span style={{ fontSize: '11px', color: '#6366f1', marginLeft: '8px' }}>(Custom)</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Keywords: {(sector.keywords || []).join(', ')}</div>
                    </div>
                    {sector.custom && (
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined' && window.confirm && window.confirm(`Delete sector "${sector.name}"?`)) {
                            deleteCustomSector(sector.id);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={(selectedSectors || []).includes(sector.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSectors([...(selectedSectors || []), sector.id]);
                        else setSelectedSectors((selectedSectors || []).filter((s) => s !== sector.id));
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    Active
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #digest-content, #digest-content * { visibility: visible; }
          #digest-content { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
    </div>
  );
}

export default FinancialCommandCenter;
