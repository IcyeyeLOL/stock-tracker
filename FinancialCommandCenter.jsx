import React, { useState, useEffect, useMemo } from 'react';
import { useStorage } from '@deepspaceai/react';

// Constants
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
  { id: 'earnings', name: 'Earnings', color: '#3b82f6', keywords: ['earnings', 'revenue', 'profit', 'quarterly', 'EPS'] },
  { id: 'guidance', name: 'Guidance', color: '#10b981', keywords: ['guidance', 'forecast', 'outlook', 'expectations'] },
  { id: 'macro', name: 'Macro', color: '#f59e0b', keywords: ['Fed', 'inflation', 'interest rates', 'GDP', 'economic'] },
  { id: 'regulation', name: 'Regulation', color: '#ef4444', keywords: ['SEC', 'regulation', 'compliance', 'law', 'legal'] },
  { id: 'product', name: 'Product', color: '#8b5cf6', keywords: ['launch', 'release', 'product', 'unveil'] },
  { id: 'm-a', name: 'M&A', color: '#ec4899', keywords: ['merger', 'acquisition', 'deal', 'buyout'] },
];

export default function FinancialCommandCenter() {
  // Storage hooks
  const [watchlist, setWatchlist] = useStorage('watchlist', []);
  const [customSectors, setCustomSectors] = useStorage('customSectors', []);
  const [positions, setPositions] = useStorage('positions', {});
  const [tickerNotes, setTickerNotes] = useStorage('tickerNotes', {});
  const [followedAccounts, setFollowedAccounts] = useStorage('followedAccounts', []);
  const [lastAlertCheck, setLastAlertCheck] = useStorage('lastAlertCheck', null);
  const [theme, setTheme] = useStorage('theme', 'light');

  // State
  const [activeView, setActiveView] = useState('dashboard');
  const [news, setNews] = useState([]);
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
  const [editingPosition, setEditingPosition] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [newTickerInput, setNewTickerInput] = useState('');

  // Apply theme to body
  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#0a0a0a' : '#ffffff';
    document.body.style.color = theme === 'dark' ? '#ffffff' : '#000000';
  }, [theme]);

  // Load initial news
  useEffect(() => {
    loadNews();
    checkAlerts();
  }, []);

  // Load news when sectors change
  useEffect(() => {
    if (selectedSectors.length > 0) {
      loadNews();
    }
  }, [selectedSectors]);

  // Functions
  const loadNews = async () => {
    setLoading(true);
    try {
      let allNews = [];
      
      if (selectedSectors.length === 0) {
        // Load general business news
        const response = await miyagiAPI('/news-top-headlines', {
          category: 'business',
          country: 'us',
          pageSize: 50,
        });
        allNews = response.articles || [];
      } else {
        // Load news for each selected sector
        const allSectors = [...SECTORS, ...customSectors];
        const sectorQueries = selectedSectors
          .map(sectorId => {
            const sector = allSectors.find(s => s.id === sectorId);
            return sector?.keywords.join(' OR ') || '';
          })
          .filter(Boolean);

        for (const query of sectorQueries) {
          try {
            const response = await miyagiAPI('/news-search', {
              q: query,
              language: 'en',
              sortBy: 'publishedAt',
              pageSize: 20,
            });
            if (response.articles) {
              allNews = [...allNews, ...response.articles];
            }
          } catch (err) {
            console.error('Error loading sector news:', err);
          }
        }
      }

      // Tag catalysts and deduplicate
      const taggedNews = allNews.map(article => ({
        ...article,
        catalysts: detectCatalysts(article),
      }));

      // Remove duplicates by URL
      const uniqueNews = Array.from(
        new Map(taggedNews.map(item => [item.url, item])).values()
      );

      setNews(uniqueNews);
    } catch (error) {
      console.error('Error loading news:', error);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const detectCatalysts = (article) => {
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    return CATALYSTS.filter(catalyst =>
      catalyst.keywords.some(keyword => text.includes(keyword.toLowerCase()))
    ).map(c => c.id);
  };

  const clusterStories = (articles) => {
    const clusters = {};
    
    articles.forEach(article => {
      // Extract key terms from title
      const words = article.title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 4);
      
      // Find best matching cluster
      let bestCluster = null;
      let bestScore = 0;
      
      Object.keys(clusters).forEach(clusterKey => {
        const clusterWords = clusterKey.split(' ');
        const matches = words.filter(w => clusterWords.includes(w)).length;
        const score = matches / Math.max(clusterWords.length, words.length);
        if (score > 0.3 && score > bestScore) {
          bestScore = score;
          bestCluster = clusterKey;
        }
      });
      
      if (bestCluster) {
        clusters[bestCluster].push(article);
      } else {
        // Create new cluster from first significant word
        const keyWord = words[0] || 'other';
        if (!clusters[keyWord]) {
          clusters[keyWord] = [];
        }
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
    stories.forEach(story => {
      story.catalysts?.forEach(cat => {
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
      const response = await miyagiAPI('/news-top-headlines', {
        category: 'business',
        country: 'us',
        pageSize: 100,
      });
      
      const newStories = (response.articles || []).filter(article => {
        const text = `${article.title} ${article.description || ''}`.toLowerCase();
        return watchlist.some(ticker => text.includes(ticker.toLowerCase()));
      });
      
      setAlerts(newStories);
      setLastAlertCheck(new Date().toISOString());
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  };

  const briefTicker = async (ticker) => {
    setLoading(true);
    setSelectedTicker(ticker);
    
    try {
      // Get news for ticker
      const newsResponse = await miyagiAPI('/news-search', {
        q: ticker,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
      });
      
      const tickerNews = newsResponse.articles || [];
      const newsSummary = tickerNews
        .slice(0, 5)
        .map(a => `- ${a.title}`)
        .join('\n');
      
      // Generate AI brief
      const briefResponse = await miyagiAPI('/generate-text', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Provide a brief executive summary for ticker ${ticker} based on recent news:\n\n${newsSummary}\n\nInclude: 1) Key developments, 2) Why it matters, 3) Main catalysts, 4) Risks. Keep it concise (3-4 bullets).`,
          },
        ],
      });
      
      // Generate forecast scenarios
      const forecastResponse = await miyagiAPI('/generate-text', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Based on the news above, provide three scenarios for ${ticker}:\n\n1. Bull Case (optimistic outcome)\n2. Base Case (most likely)\n3. Bear Case (pessimistic outcome)\n\nEach scenario should include a realistic price target and reasoning.`,
          },
        ],
      });
      
      setTickerBrief({
        ticker,
        news: tickerNews,
        summary: briefResponse.text || briefResponse.content || 'Unable to generate summary.',
        forecast: forecastResponse.text || forecastResponse.content || 'Unable to generate forecast.',
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
      const response = await miyagiAPI('/news-top-headlines', {
        category: 'business',
        country: 'us',
        pageSize: 50,
      });
      
      const articles = response.articles || [];
      const topMovers = watchlist.slice(0, 5).map(ticker => {
        const tickerNews = articles.filter(a => 
          `${a.title} ${a.description || ''}`.toLowerCase().includes(ticker.toLowerCase())
        );
        return { ticker, newsCount: tickerNews.length };
      }).sort((a, b) => b.newsCount - a.newsCount);
      
      const digestPrompt = `Generate a daily market digest based on these headlines:\n\n${articles.slice(0, 20).map(a => `- ${a.title}`).join('\n')}\n\nInclude: 1) Market summary, 2) Key movers (${topMovers.map(t => t.ticker).join(', ')}), 3) Catalysts to watch, 4) Actionable insights. Format as a professional newsletter.`;
      
      const digestResponse = await miyagiAPI('/generate-text', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: digestPrompt,
          },
        ],
      });
      
      setDigest({
        date: new Date().toLocaleDateString(),
        content: digestResponse.text || digestResponse.content || 'Unable to generate digest.',
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

  const addCustomSector = (name, keywords) => {
    const newSector = {
      id: `custom-${Date.now()}`,
      name,
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      custom: true,
    };
    setCustomSectors([...customSectors, newSector]);
  };

  const deleteCustomSector = (sectorId) => {
    setCustomSectors(customSectors.filter(s => s.id !== sectorId));
    setSelectedSectors(selectedSectors.filter(s => s !== sectorId));
  };

  const searchSocial = async () => {
    if (!socialSearchQuery.trim()) return;
    
    setSocialLoading(true);
    try {
      if (socialSearchPlatform === 'linkedin') {
        const response = await miyagiAPI('/linkedin-search-profiles', {
          query: socialSearchQuery, // Pure search, no filter
        });
        setSocialResults((response.profiles || []).map(profile => ({
          ...profile,
          platform: 'linkedin',
        })));
      } else if (socialSearchPlatform === 'youtube') {
        const response = await miyagiAPI('/youtube-search', {
          q: socialSearchQuery, // Pure search, no filter
          maxResults: 20,
        });
        setSocialResults((response.items || []).map(item => ({
          ...item,
          platform: 'youtube',
        })));
      }
    } catch (error) {
      console.error('Error searching social:', error);
      setSocialResults([]);
    } finally {
      setSocialLoading(false);
    }
  };

  const followAccount = (account) => {
    // Check if already following
    const isFollowing = followedAccounts.some(
      acc => acc.id === account.id && acc.platform === account.platform
    );
    
    if (!isFollowing) {
      setFollowedAccounts([...followedAccounts, account]);
    }
  };

  const unfollowAccount = (accountId, platform) => {
    setFollowedAccounts(
      followedAccounts.filter(
        acc => !(acc.id === accountId && acc.platform === platform)
      )
    );
  };

  const updatePosition = (ticker, positionData) => {
    setPositions({
      ...positions,
      [ticker]: positionData,
    });
  };

  const deletePosition = (ticker) => {
    const newPositions = { ...positions };
    delete newPositions[ticker];
    setPositions(newPositions);
  };

  const parsePriceFromNews = (article) => {
    const text = `${article.title} ${article.description || ''}`;
    const percentMatch = text.match(/(?:up|down|rose|fell|gained|lost)\s+([\d.]+)%/i);
    const priceMatch = text.match(/\$([\d,]+\.?\d*)/g);
    if (percentMatch) return { change: parseFloat(percentMatch[1]), type: 'percent' };
    if (priceMatch) return { change: parseFloat(priceMatch[0].replace(/[$,]/g, '')), type: 'price' };
    return null;
  };

  const emailDigest = async () => {
    if (!digest) return;
    
    setEmailLoading(true);
    try {
      await miyagiAPI('/send-email', {
        to: 'user@example.com', // Replace with actual email
        subject: `Daily Market Digest - ${digest.date}`,
        html: `
          <h1>Daily Market Digest</h1>
          <p><strong>Date:</strong> ${digest.date}</p>
          <div style="white-space: pre-wrap;">${digest.content}</div>
        `,
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

  const addTickerToWatchlist = async () => {
    if (!newTickerInput.trim()) return;
    
    const ticker = newTickerInput.trim().toUpperCase();
    
    // Check if already in watchlist
    if (watchlist.includes(ticker)) {
      alert(`${ticker} is already in your watchlist.`);
      return;
    }
    
    // Verify ticker exists
    try {
      const response = await miyagiAPI('/search-stocks', {
        query: ticker,
      });
      
      if (response.results && response.results.length > 0) {
        setWatchlist([...watchlist, ticker]);
        setNewTickerInput('');
        alert(`${ticker} added to watchlist!`);
      } else {
        alert(`Could not find ticker ${ticker}. Please verify the symbol.`);
      }
    } catch (error) {
      console.error('Error adding ticker:', error);
      // Still add it if search fails (user might know better)
      setWatchlist([...watchlist, ticker]);
      setNewTickerInput('');
      alert(`${ticker} added to watchlist (could not verify).`);
    }
  };

  // Computed values
  const filteredNews = useMemo(() => {
    let filtered = news;
    
    if (selectedCatalysts.length > 0) {
      filtered = filtered.filter(article =>
        article.catalysts?.some(cat => selectedCatalysts.includes(cat))
      );
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article =>
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
    catalystsFound: new Set(news.flatMap(n => n.catalysts || [])).size,
  }), [news, watchlist, alerts]);

  // Styles
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0a0a0a' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const borderColor = isDark ? '#2a2a2a' : '#f0f0f0';
  const cardBg = isDark ? '#1a1a1a' : '#ffffff';
  const shadow = isDark ? 'none' : '0 4px 24px rgba(0, 0, 0, 0.04)';

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: bgColor,
      color: textColor,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}>
      {/* Sidebar */}
      <div style={{
        width: '280px',
        borderRight: `1px solid ${borderColor}`,
        padding: '24px',
        overflowY: 'auto',
        backgroundColor: cardBg,
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
            📊 Command Center
          </h1>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            style={{
              padding: '6px 12px',
              border: `1px solid ${borderColor}`,
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: textColor,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ marginBottom: '32px' }}>
          {[
            { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
            { id: 'watchlist', label: '⭐ Watchlist', icon: '⭐' },
            { id: 'alerts', label: '🔔 Alerts', icon: '🔔' },
            { id: 'ticker', label: '📰 Ticker Detail', icon: '📰' },
            { id: 'digest', label: '📋 Digest', icon: '📋' },
            { id: 'social', label: '🌐 Social', icon: '🌐' },
            { id: 'portfolio', label: '💼 Portfolio', icon: '💼' },
            { id: 'sectors', label: '🏢 Sectors', icon: '🏢' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '8px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: activeView === item.id ? '#6366f1' : 'transparent',
                color: activeView === item.id ? '#ffffff' : textColor,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: activeView === item.id ? '600' : '400',
                transition: 'all 0.2s',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Stats */}
        <div style={{
          padding: '16px',
          backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
          borderRadius: '8px',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666', marginBottom: '12px' }}>
            Real-Time Stats
          </div>
          <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
            <div>Stories: <strong>{stats.totalStories}</strong></div>
            <div>Watchlist: <strong>{stats.watchlistSize}</strong></div>
            <div>Alerts: <strong>{stats.alertsCount}</strong></div>
            <div>Catalysts: <strong>{stats.catalystsFound}</strong></div>
          </div>
        </div>

        {/* Sectors */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
            Sectors ({SECTORS.length + customSectors.length})
          </div>
          {[...SECTORS, ...customSectors].slice(0, 5).map(sector => (
            <label key={sector.id} style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={selectedSectors.includes(sector.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedSectors([...selectedSectors, sector.id]);
                  } else {
                    setSelectedSectors(selectedSectors.filter(s => s !== sector.id));
                  }
                }}
                style={{ marginRight: '8px' }}
              />
              {sector.name}
              {sector.custom && <span style={{ fontSize: '10px', color: '#6366f1', marginLeft: '4px' }}>(Custom)</span>}
            </label>
          ))}
          {customSectors.length + SECTORS.length > 5 && (
            <button
              onClick={() => setActiveView('sectors')}
              style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#6366f1',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              View All →
            </button>
          )}
        </div>

        {/* Catalysts */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
            Catalysts
          </div>
          {CATALYSTS.map(catalyst => (
            <label key={catalyst.id} style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={selectedCatalysts.includes(catalyst.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCatalysts([...selectedCatalysts, catalyst.id]);
                  } else {
                    setSelectedCatalysts(selectedCatalysts.filter(c => c !== catalyst.id));
                  }
                }}
                style={{ marginRight: '8px' }}
              />
              <span style={{ color: catalyst.color }}>●</span> {catalyst.name}
            </label>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        {/* Search Bar */}
        {(activeView === 'dashboard' || activeView === 'alerts') && (
          <div style={{ marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: cardBg,
                color: textColor,
              }}
            />
          </div>
        )}

        {/* Dashboard View */}
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
                {loading ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>

            {loading && news.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#666' : '#999' }}>
                Loading news...
              </div>
            ) : clusteredNews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#666' : '#999' }}>
                No news found. Try adjusting filters.
              </div>
            ) : (
              <div>
                {clusteredNews.map((cluster, idx) => (
                  <div key={idx} style={{
                    marginBottom: '24px',
                    padding: '20px',
                    backgroundColor: cardBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '12px',
                    boxShadow: shadow,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600' }}>
                        {cluster.key.charAt(0).toUpperCase() + cluster.key.slice(1)} ({cluster.size} stories)
                      </h3>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {cluster.topCatalysts.map(catId => {
                          const cat = CATALYSTS.find(c => c.id === catId);
                          return cat ? (
                            <span key={catId} style={{
                              padding: '4px 8px',
                              backgroundColor: cat.color + '20',
                              color: cat.color,
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '500',
                            }}>
                              {cat.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                      {cluster.stories.slice(0, 6).map((article, aidx) => (
                        <a
                          key={aidx}
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '16px',
                            backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                            border: `1px solid ${borderColor}`,
                            borderRadius: '8px',
                            textDecoration: 'none',
                            color: textColor,
                            display: 'block',
                            transition: 'transform 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', lineHeight: '1.4' }}>
                            {article.title}
                          </div>
                          <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666', marginBottom: '8px' }}>
                            {article.source?.name || 'Unknown'} • {new Date(article.publishedAt).toLocaleDateString()}
                          </div>
                          {article.catalysts && article.catalysts.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {article.catalysts.map(catId => {
                                const cat = CATALYSTS.find(c => c.id === catId);
                                return cat ? (
                                  <span key={catId} style={{
                                    padding: '2px 6px',
                                    backgroundColor: cat.color + '20',
                                    color: cat.color,
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                  }}>
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

        {/* Watchlist View */}
        {activeView === 'watchlist' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Watchlist</h2>
            
            {/* Add Ticker Form */}
            <div style={{
              padding: '20px',
              backgroundColor: cardBg,
              border: `1px solid ${borderColor}`,
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: shadow,
            }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Add Ticker</div>
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
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                    color: textColor,
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

            {watchlist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#666' : '#999' }}>
                No tickers in watchlist. Add some above!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                {watchlist.map(ticker => (
                  <div key={ticker} style={{
                    padding: '20px',
                    backgroundColor: cardBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '12px',
                    boxShadow: shadow,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600' }}>{ticker}</div>
                      <button
                        onClick={() => setWatchlist(watchlist.filter(t => t !== ticker))}
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
                      {loading && selectedTicker === ticker ? 'Loading...' : '✨ Brief Me'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alerts View */}
        {activeView === 'alerts' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Alerts</h2>
              <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666' }}>
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
              {loading ? 'Checking...' : '🔄 Check Alerts'}
            </button>

            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#666' : '#999' }}>
                No alerts. Your watchlist stocks haven't been mentioned recently.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {alerts.map((article, idx) => (
                  <a
                    key={idx}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '20px',
                      backgroundColor: cardBg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '12px',
                      boxShadow: shadow,
                      textDecoration: 'none',
                      color: textColor,
                      display: 'block',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', lineHeight: '1.4' }}>
                      {article.title}
                    </div>
                    <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666', marginBottom: '12px' }}>
                      {article.source?.name || 'Unknown'} • {new Date(article.publishedAt).toLocaleDateString()}
                    </div>
                    {article.catalysts && article.catalysts.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {article.catalysts.map(catId => {
                          const cat = CATALYSTS.find(c => c.id === catId);
                          return cat ? (
                            <span key={catId} style={{
                              padding: '4px 8px',
                              backgroundColor: cat.color + '20',
                              color: cat.color,
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '500',
                            }}>
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

        {/* Ticker Detail View */}
        {activeView === 'ticker' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Ticker Detail</h2>
            {!tickerBrief ? (
              <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#666' : '#999' }}>
                Select a ticker from Watchlist and click "Brief Me" to see details.
              </div>
            ) : (
              <div>
                <div style={{
                  padding: '24px',
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '12px',
                  marginBottom: '24px',
                  boxShadow: shadow,
                }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
                    {tickerBrief.ticker} - Executive Brief
                  </h3>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: '24px' }}>
                    {tickerBrief.summary}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Forecast Scenarios</h4>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                      {tickerBrief.forecast}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Recent News</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {tickerBrief.news.map((article, idx) => (
                      <a
                        key={idx}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '16px',
                          backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                          border: `1px solid ${borderColor}`,
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: textColor,
                          display: 'block',
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                          {article.title}
                        </div>
                        <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666' }}>
                          {article.source?.name || 'Unknown'} • {new Date(article.publishedAt).toLocaleDateString()}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Digest View */}
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
                  {loading ? 'Generating...' : '📋 Generate Digest'}
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
                      {emailLoading ? 'Sending...' : '📧 Email'}
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
                      📄 Export PDF
                    </button>
                  </>
                )}
              </div>
            </div>

            {!digest ? (
              <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#666' : '#999' }}>
                Click "Generate Digest" to create a daily market summary.
              </div>
            ) : (
              <div id="digest-content" style={{
                padding: '32px',
                backgroundColor: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: '12px',
                boxShadow: shadow,
              }}>
                <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${borderColor}` }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Daily Market Digest</h3>
                  <div style={{ fontSize: '14px', color: isDark ? '#a0a0a0' : '#666' }}>{digest.date}</div>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '15px', marginBottom: '32px' }}>
                  {digest.content}
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Key Articles</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                    {digest.articles.map((article, idx) => (
                      <a
                        key={idx}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '12px',
                          backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                          border: `1px solid ${borderColor}`,
                          borderRadius: '6px',
                          textDecoration: 'none',
                          color: textColor,
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

        {/* Social View */}
        {activeView === 'social' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Social Tracking</h2>
            
            {/* Platform Toggle */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <button
                onClick={() => setSocialSearchPlatform('linkedin')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: socialSearchPlatform === 'linkedin' ? '#6366f1' : 'transparent',
                  color: socialSearchPlatform === 'linkedin' ? '#ffffff' : textColor,
                  border: `1px solid ${borderColor}`,
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
                  color: socialSearchPlatform === 'youtube' ? '#ffffff' : textColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                YouTube
              </button>
            </div>

            {/* Search */}
            <div style={{
              padding: '20px',
              backgroundColor: cardBg,
              border: `1px solid ${borderColor}`,
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: shadow,
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder={`Search ${socialSearchPlatform === 'linkedin' ? 'LinkedIn profiles' : 'YouTube channels/videos'}...`}
                  value={socialSearchQuery}
                  onChange={(e) => setSocialSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchSocial()}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                    color: textColor,
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

            {/* Following Section */}
            {followedAccounts.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Following ({followedAccounts.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                  {followedAccounts.map((account, idx) => {
                    const isLinkedIn = account.platform === 'linkedin';
                    const linkUrl = isLinkedIn 
                      ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(account.name || account.headline || '')}`
                      : account.id?.videoId 
                        ? `https://www.youtube.com/watch?v=${account.id.videoId}`
                        : account.snippet?.channelId
                          ? `https://www.youtube.com/channel/${account.snippet.channelId}`
                          : `https://www.youtube.com/results?search_query=${encodeURIComponent(account.snippet?.title || account.title || '')}`;
                    
                    return (
                      <div key={idx} style={{
                        padding: '16px',
                        backgroundColor: cardBg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '12px',
                        boxShadow: shadow,
                      }}>
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
                              {account.name || account.snippet?.title || account.title || 'Unknown'}
                            </a>
                            <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666' }}>
                              {isLinkedIn ? account.headline : account.snippet?.channelTitle}
                            </div>
                            <span style={{
                              display: 'inline-block',
                              marginTop: '8px',
                              padding: '4px 8px',
                              backgroundColor: isLinkedIn ? '#0077b5' : '#ff0000',
                              color: '#ffffff',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '500',
                            }}>
                              {isLinkedIn ? 'LinkedIn' : 'YouTube'}
                            </span>
                          </div>
                          <button
                            onClick={() => unfollowAccount(account.id || account.snippet?.channelId, account.platform)}
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

            {/* Search Results */}
            {socialResults.length > 0 && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Search Results</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                  {socialResults.map((result, idx) => {
                    const isLinkedIn = result.platform === 'linkedin';
                    const isFollowing = followedAccounts.some(
                      acc => acc.id === result.id && acc.platform === result.platform
                    );
                    
                    // Fix: Proper link routing based on platform
                    const linkUrl = isLinkedIn
                      ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(result.name || result.headline || socialSearchQuery)}`
                      : result.id?.videoId
                        ? `https://www.youtube.com/watch?v=${result.id.videoId}`
                        : result.snippet?.channelId
                          ? `https://www.youtube.com/channel/${result.snippet.channelId}`
                          : `https://www.youtube.com/results?search_query=${encodeURIComponent(result.snippet?.title || result.title || socialSearchQuery)}`;

                    return (
                      <div key={idx} style={{
                        padding: '16px',
                        backgroundColor: cardBg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '12px',
                        boxShadow: shadow,
                      }}>
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
                            {result.name || result.snippet?.title || result.title || 'Unknown'}
                          </a>
                          <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666', marginBottom: '8px' }}>
                            {isLinkedIn ? result.headline : result.snippet?.channelTitle || result.snippet?.description}
                          </div>
                          {isLinkedIn && result.location && (
                            <div style={{ fontSize: '11px', color: isDark ? '#888' : '#999' }}>
                              📍 {result.location}
                            </div>
                          )}
                          {!isLinkedIn && result.snippet?.publishedAt && (
                            <div style={{ fontSize: '11px', color: isDark ? '#888' : '#999' }}>
                              📅 {new Date(result.snippet.publishedAt).toLocaleDateString()}
                            </div>
                          )}
                          <span style={{
                            display: 'inline-block',
                            marginTop: '8px',
                            padding: '4px 8px',
                            backgroundColor: isLinkedIn ? '#0077b5' : '#ff0000',
                            color: '#ffffff',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '500',
                          }}>
                            {isLinkedIn ? 'LinkedIn' : 'YouTube'}
                          </span>
                        </div>
                        <button
                          onClick={() => isFollowing ? unfollowAccount(result.id || result.snippet?.channelId, result.platform) : followAccount(result)}
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
                          {isFollowing ? '✓ Following' : '+ Follow'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!socialLoading && socialResults.length === 0 && socialSearchQuery && (
              <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#666' : '#999' }}>
                No results found. Try a different search query.
              </div>
            )}
          </div>
        )}

        {/* Portfolio View */}
        {activeView === 'portfolio' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Portfolio</h2>
            
            {/* Manual Stock Tracking */}
            <div style={{
              padding: '20px',
              backgroundColor: cardBg,
              border: `1px solid ${borderColor}`,
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: shadow,
            }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Track Stock</div>
              <div style={{ fontSize: '13px', color: isDark ? '#a0a0a0' : '#666', marginBottom: '16px' }}>
                Add a stock symbol to track on your dashboard. You can add notes and position details later.
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
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                    color: textColor,
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

            {/* Positions */}
            {Object.keys(positions).length === 0 && watchlist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#666' : '#999' }}>
                No positions tracked. Add stocks above to get started!
              </div>
            ) : (
              <div>
                {/* P&L Summary */}
                {Object.keys(positions).length > 0 && (
                  <div style={{
                    padding: '20px',
                    backgroundColor: cardBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '12px',
                    marginBottom: '24px',
                    boxShadow: shadow,
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Portfolio Summary</h3>
                    {(() => {
                      const totalCost = Object.values(positions).reduce((sum, pos) => sum + (pos.costBasis || 0), 0);
                      const totalValue = Object.values(positions).reduce((sum, pos) => sum + (pos.currentValue || 0), 0);
                      const totalPL = totalValue - totalCost;
                      const totalPLPercent = totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(2) : 0;
                      
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666', marginBottom: '4px' }}>Total Cost</div>
                            <div style={{ fontSize: '20px', fontWeight: '600' }}>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666', marginBottom: '4px' }}>Current Value</div>
                            <div style={{ fontSize: '20px', fontWeight: '600' }}>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666', marginBottom: '4px' }}>P&L</div>
                            <div style={{ fontSize: '20px', fontWeight: '600', color: totalPL >= 0 ? '#10b981' : '#ef4444' }}>
                              ${totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalPLPercent}%)
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Positions List */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {[...new Set([...watchlist, ...Object.keys(positions)])].map(ticker => {
                    const position = positions[ticker] || {};
                    const notes = tickerNotes[ticker] || '';
                    const costBasis = (position.quantity || 0) * (position.entryPrice || 0);
                    const currentValue = (position.quantity || 0) * (position.currentPrice || position.entryPrice || 0);
                    const pl = currentValue - costBasis;
                    const plPercent = costBasis > 0 ? ((pl / costBasis) * 100).toFixed(2) : 0;

                    return (
                      <div key={ticker} style={{
                        padding: '20px',
                        backgroundColor: cardBg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '12px',
                        boxShadow: shadow,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <div style={{ fontSize: '20px', fontWeight: '600' }}>{ticker}</div>
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${ticker} from tracking?`)) {
                                setWatchlist(watchlist.filter(t => t !== ticker));
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
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                                  color: textColor,
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
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                                  color: textColor,
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
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                                  color: textColor,
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
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                                  color: textColor,
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
                                  backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
                                  color: textColor,
                                  border: `1px solid ${borderColor}`,
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
                                    <div style={{ color: isDark ? '#a0a0a0' : '#666' }}>Quantity</div>
                                    <div style={{ fontWeight: '600' }}>{position.quantity}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: isDark ? '#a0a0a0' : '#666' }}>Entry</div>
                                    <div style={{ fontWeight: '600' }}>${position.entryPrice?.toFixed(2) || '0.00'}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: isDark ? '#a0a0a0' : '#666' }}>Current</div>
                                    <div style={{ fontWeight: '600' }}>${position.currentPrice?.toFixed(2) || position.entryPrice?.toFixed(2) || '0.00'}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: isDark ? '#a0a0a0' : '#666' }}>Target</div>
                                    <div style={{ fontWeight: '600' }}>${position.targetPrice?.toFixed(2) || 'N/A'}</div>
                                  </div>
                                </div>
                                <div style={{
                                  padding: '12px',
                                  backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                  borderRadius: '8px',
                                  marginTop: '12px',
                                }}>
                                  <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666', marginBottom: '4px' }}>P&L</div>
                                  <div style={{ fontSize: '18px', fontWeight: '600', color: pl >= 0 ? '#10b981' : '#ef4444' }}>
                                    ${pl.toFixed(2)} ({plPercent}%)
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginBottom: '16px', fontSize: '13px', color: isDark ? '#a0a0a0' : '#666' }}>
                                No position data. Click "Edit Position" to add.
                              </div>
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
                                onChange={(e) => setTickerNotes({ ...tickerNotes, [ticker]: e.target.value })}
                                placeholder="Add notes about this stock..."
                                style={{
                                  width: '100%',
                                  minHeight: '80px',
                                  padding: '8px',
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                                  color: textColor,
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

        {/* Sectors View */}
        {activeView === 'sectors' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Sectors</h2>
              <button
                onClick={() => {
                  const name = prompt('Sector name:');
                  if (name) {
                    const keywords = prompt('Keywords (comma-separated):');
                    if (keywords) {
                      addCustomSector(name, keywords);
                    }
                  }
                }}
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
                + Add Custom Sector
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
              {[...SECTORS, ...customSectors].map(sector => (
                <div key={sector.id} style={{
                  padding: '20px',
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '12px',
                  boxShadow: shadow,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
                        {sector.name}
                        {sector.custom && <span style={{ fontSize: '11px', color: '#6366f1', marginLeft: '8px' }}>(Custom)</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: isDark ? '#a0a0a0' : '#666' }}>
                        Keywords: {sector.keywords.join(', ')}
                      </div>
                    </div>
                    {sector.custom && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete sector "${sector.name}"?`)) {
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
                      checked={selectedSectors.includes(sector.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSectors([...selectedSectors, sector.id]);
                        } else {
                          setSelectedSectors(selectedSectors.filter(s => s !== sector.id));
                        }
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

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #digest-content, #digest-content * {
            visibility: visible;
          }
          #digest-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
