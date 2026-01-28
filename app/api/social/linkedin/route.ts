import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter is required' },
      { status: 400 }
    )
  }

  // LinkedIn doesn't have a public API for profile search
  // We'll return a structure that allows users to manually add profiles
  // and link to LinkedIn search results
  
  try {
    // Return mock results with LinkedIn search URLs
    // Users can click to go to LinkedIn and manually add profiles
    const results = [
      {
        id: `linkedin-search-${Date.now()}`,
        platform: 'linkedin' as const,
        name: query,
        headline: 'Click to search LinkedIn',
        location: '',
        searchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`,
      },
    ]

    return NextResponse.json({ 
      results,
      message: 'LinkedIn API is not publicly available. Click the link to search on LinkedIn and manually add profiles.',
    })
  } catch (error) {
    console.error('Error searching LinkedIn:', error)
    return NextResponse.json(
      { error: 'Failed to search LinkedIn', results: [] },
      { status: 500 }
    )
  }
}
