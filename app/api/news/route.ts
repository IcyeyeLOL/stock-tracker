import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const category = searchParams.get('category') || 'business'
  const query = searchParams.get('q')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  try {
    const apiKey = process.env.NEWS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'News API key not configured' },
        { status: 500 }
      )
    }

    let url: string
    if (query) {
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${apiKey}`
    } else {
      url = `https://newsapi.org/v2/top-headlines?category=${category}&country=us&pageSize=${pageSize}&apiKey=${apiKey}`
    }

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'ok') {
      return NextResponse.json(data)
    } else {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch news' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error fetching news:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}
