/**
 * Adapter: maps widget miyagiAPI(endpoint, body) calls to Stock Tracker /api routes.
 * Return shapes match what FinancialCommandCenter.jsx expects (response.articles, .profiles, .items, .results, .text).
 */

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_APP_URL || '';

async function request(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(url.startsWith('http') ? url : `${API_BASE}${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || data.message || res.statusText };
    }
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Request failed' };
  }
}

export async function miyagiAPI(
  endpoint: string,
  body: Record<string, any> = {}
): Promise<Record<string, any>> {
  const b = body as any;

  // News: top headlines
  if (endpoint === '/news-top-headlines') {
    const category = b.category || 'business';
    const pageSize = b.pageSize || 50;
    const { ok, data, error } = await request(
      `/api/news?category=${encodeURIComponent(category)}&pageSize=${pageSize}`
    );
    if (!ok) return { articles: [], error };
    return { articles: data.articles || [] };
  }

  // News: search
  if (endpoint === '/news-search') {
    const q = b.q || '';
    const pageSize = b.pageSize || 20;
    const { ok, data, error } = await request(
      `/api/news?q=${encodeURIComponent(q)}&pageSize=${pageSize}`
    );
    if (!ok) return { articles: [], error };
    return { articles: data.articles || [] };
  }

  // AI generate: widget sends messages[] or prompt; our API expects prompt
  if (endpoint === '/generate-text') {
    const prompt =
      b.messages?.[0]?.content ?? b.prompt ?? '';
    const model = b.model || 'gpt-4o-mini';
    const { ok, data, error } = await request('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, model }),
    });
    if (!ok) return { text: '', content: '', error };
    const text = data.text || '';
    return { text, content: text };
  }

  // Stocks search: our API uses query param "query"
  if (endpoint === '/search-stocks') {
    const query = b.query ?? b.term ?? '';
    const { ok, data, error } = await request(
      `/api/stocks?query=${encodeURIComponent(query)}`
    );
    if (!ok) return { results: [], error };
    return { results: data.results || [] };
  }

  // LinkedIn: our API uses ?q=
  if (endpoint === '/linkedin-search-profiles') {
    const q = b.q ?? b.query ?? b.name ?? '';
    const { ok, data, error } = await request(
      `/api/social/linkedin?q=${encodeURIComponent(q)}`
    );
    if (!ok) return { profiles: [], error };
    const results = data.results || [];
    const profiles = results.map((r: any) => ({
      ...r,
      link: r.searchUrl || r.link,
    }));
    return { profiles };
  }

  // YouTube: our API uses ?q= and maxResults
  if (endpoint === '/youtube-search') {
    const q = b.q ?? b.query ?? '';
    const maxResults = b.maxResults ?? 20;
    const { ok, data, error } = await request(
      `/api/social/youtube?q=${encodeURIComponent(q)}&maxResults=${maxResults}`
    );
    if (!ok) return { items: [], results: [], error };
    const results = data.results || [];
    const items = results.map((r: any) => ({
      ...r,
      id: { videoId: r.videoId, channelId: r.channelId },
      snippet: {
        title: r.name,
        channelTitle: r.channelTitle,
        description: r.description,
        publishedAt: r.publishedAt,
      },
    }));
    return { items, results };
  }

  // Send email: no backend in Stock Tracker; no-op
  if (endpoint === '/send-email') {
    return { ok: true };
  }

  return { error: `Unknown endpoint: ${endpoint}` };
}
