import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const symbol = searchParams.get('symbol')?.trim().toUpperCase()

  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol parameter is required (e.g. ?symbol=AAPL)' },
      { status: 400 }
    )
  }

  try {
    const apiKey = process.env.ALPHA_VANTAGE_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Alpha Vantage API key not configured' },
        { status: 500 }
      )
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
    const response = await fetch(url)
    const data = await response.json()

    if (data['Error Message']) {
      return NextResponse.json(
        { error: data['Error Message'] },
        { status: 400 }
      )
    }

    if (data['Note']) {
      return NextResponse.json(
        { error: 'API rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    const q = data['Global Quote']
    if (!q || !q['05. price']) {
      return NextResponse.json(
        { error: `No quote data for ${symbol}` },
        { status: 404 }
      )
    }

    const quote = {
      symbol: q['01. symbol'] || symbol,
      price: parseFloat(q['05. price']) || 0,
      open: parseFloat(q['02. open']) || 0,
      high: parseFloat(q['03. high']) || 0,
      low: parseFloat(q['04. low']) || 0,
      change: parseFloat(q['09. change']) || 0,
      changePercent: (q['10. change percent'] || '0%').replace(/^"?|"?$/g, ''),
      volume: String(q['06. volume'] || '0'),
      latestTradingDay: q['07. latest trading day'] || '',
    }

    return NextResponse.json(quote)
  } catch (error) {
    console.error('Error fetching quote:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    )
  }
}
