import { NextRequest, NextResponse } from 'next/server'

/**
 * YouTube Data API v3 search.
 * Env: YOUTUBE_API_KEY in .env
 * If you get "referrer blocked" or 403: In Google Cloud Console, set the key's
 * Application restrictions to "None" (or "IP addresses"). HTTP referrer blocks server requests.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required', results: [] },
      { status: 400 }
    )
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'YouTube API key not configured',
      message:
        'Add YOUTUBE_API_KEY to your .env file. Get a key at Google Cloud Console → APIs & Services → Credentials, and enable "YouTube Data API v3" for the project.',
      results: [],
    })
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      maxResults: '20',
      type: 'channel,video',
      key: apiKey,
    })
    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
    const res = await fetch(url)
    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message || data?.error?.errors?.[0]?.message || `YouTube API error (${res.status})`
      const hint =
        msg.includes('referrer') || msg.includes('blocked') || res.status === 403
          ? ' If the key has HTTP referrer restrictions, set Application restrictions to "None" or "IP addresses" in Google Cloud Console.'
          : ''
      return NextResponse.json(
        { error: msg + hint, results: [] },
        { status: res.status >= 500 ? 500 : 400 }
      )
    }

    if (data.error) {
      const msg =
        data.error.message || data.error.errors?.[0]?.message || 'YouTube API returned an error'
      return NextResponse.json({ error: msg, results: [] }, { status: 400 })
    }

    const items = Array.isArray(data.items) ? data.items : []
    const seen = new Set<string>()
    const results: {
      id: string
      platform: 'youtube'
      name: string
      channelTitle?: string
      description?: string
      publishedAt?: string
      videoId?: string
      channelId?: string
      thumbnail?: string
    }[] = []

    for (const item of items) {
      const id = item?.id?.channelId || item?.id?.videoId
      if (!id || !item?.snippet) continue
      if (seen.has(id)) continue
      seen.add(id)
      results.push({
        id,
        platform: 'youtube',
        name: item.snippet.title || '',
        channelTitle: item.snippet.channelTitle ?? item.snippet.title,
        description: item.snippet.description || '',
        publishedAt: item.snippet.publishedAt || '',
        videoId: item.id?.videoId,
        channelId: item.id?.channelId,
        thumbnail: item.snippet.thumbnails?.default?.url,
      })
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('YouTube search error:', err)
    return NextResponse.json(
      { error: 'Request to YouTube failed. Check the server logs.', results: [] },
      { status: 500 }
    )
  }
}
