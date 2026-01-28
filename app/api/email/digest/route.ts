import { NextRequest, NextResponse } from 'next/server'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, digest } = body as {
      email?: string
      digest?: { date: string; content: string; articles: { title: string; url: string }[] }
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    if (!digest || !digest.date || !digest.content) {
      return NextResponse.json(
        { error: 'Digest data is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Email is not configured',
          message: 'Add RESEND_API_KEY to .env in the project root, then restart the dev server (stop with Ctrl+C, run npm run dev again). Key from resend.com → API Keys.',
        },
        { status: 501 }
      )
    }

    const from = process.env.RESEND_FROM || 'Stock Tracker Digest <onboarding@resend.dev>'
    const subject = `Your Daily Market Digest – ${digest.date}`

    const articlesHtml = (digest.articles || [])
      .slice(0, 10)
      .map(
        (a) =>
          `<li><a href="${escapeHtml(a.url || '#')}" style="color:#2563eb;">${escapeHtml(a.title || 'Article')}</a></li>`
      )
      .join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #000;">
  <h1 style="font-size: 1.5rem; margin-bottom: 4px;">Daily Market Digest</h1>
  <p style="color: #666; font-size: 0.875rem; margin-bottom: 24px;">${escapeHtml(digest.date)}</p>
  <div style="white-space: pre-wrap; line-height: 1.6; margin-bottom: 24px;">${escapeHtml(digest.content)}</div>
  <h2 style="font-size: 1.125rem; margin-bottom: 12px;">Key Articles</h2>
  <ul style="padding-left: 20px; margin: 0 0 24px;">${articlesHtml}</ul>
  <p style="font-size: 0.75rem; color: #888;">You received this because you requested the digest from Stock Tracker. Use "Export PDF" on the Digest page to save as PDF.</p>
</body>
</html>
`.trim()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [trimmed],
        subject,
        html,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data.message || data.error?.message || `Resend API error (${res.status})`
      return NextResponse.json(
        { error: msg },
        { status: res.status >= 500 ? 502 : 400 }
      )
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('Digest email error:', err)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
