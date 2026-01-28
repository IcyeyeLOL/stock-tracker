'use client'

import { useState } from 'react'
import { useStorage } from '@/hooks/useStorage'
import { Digest as DigestType } from '@/types'

export default function Digest() {
  const [watchlist] = useStorage<string[]>('watchlist', [])
  const [digest, setDigest] = useState<DigestType | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  const generateDigest = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/news?category=business&pageSize=50')
      const data = await response.json()
      const articles = data.articles || []
      
      const topMovers = watchlist.slice(0, 5).map(ticker => {
        const tickerNews = articles.filter((a: any) => 
          `${a.title} ${a.description || ''}`.toLowerCase().includes(ticker.toLowerCase())
        )
        return { ticker, newsCount: tickerNews.length }
      }).sort((a, b) => b.newsCount - a.newsCount)
      
      const digestPrompt = `Generate a daily market digest based on these headlines:\n\n${articles.slice(0, 20).map((a: any) => `- ${a.title}`).join('\n')}\n\nInclude: 1) Market summary, 2) Key movers (${topMovers.map(t => t.ticker).join(', ')}), 3) Catalysts to watch, 4) Actionable insights. Format as a professional newsletter.`
      
      const digestResponse = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: digestPrompt }),
      })
      const digestData = await digestResponse.json()
      
      setDigest({
        date: new Date().toLocaleDateString(),
        content: digestData.text || 'Unable to generate digest.',
        articles: articles.slice(0, 10),
      })
    } catch (error) {
      console.error('Error generating digest:', error)
      setDigest({
        date: new Date().toLocaleDateString(),
        content: 'Error generating digest. Please try again.',
        articles: [],
      })
    } finally {
      setLoading(false)
    }
  }

  const openEmailModal = () => {
    if (!digest) return
    setShowEmailModal(true)
    setEmailInput('')
    setEmailError(null)
  }

  const sendDigestEmail = async () => {
    if (!digest) return
    const email = emailInput.trim()
    if (!email) {
      setEmailError('Please enter your email address.')
      return
    }
    setEmailError(null)
    setEmailLoading(true)
    try {
      const res = await fetch('/api/email/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          digest: {
            date: digest.date,
            content: digest.content,
            articles: (digest.articles || []).map((a) => ({ title: a.title, url: a.url })),
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEmailError(data.error || data.message || 'Failed to send. Check RESEND_API_KEY in .env.')
        return
      }
      setShowEmailModal(false)
      setEmailInput('')
      alert('Digest sent! Check your inbox.')
    } catch (err) {
      console.error('Send digest email:', err)
      setEmailError('Failed to send. Please try again.')
    } finally {
      setEmailLoading(false)
    }
  }

  const exportToPDF = () => {
    const ok = window.confirm(
      'Download digest as PDF?\n\nYour browser will open the print dialog — choose "Save as PDF" or "Microsoft Print to PDF" as the destination, then save the file.'
    )
    if (ok) window.print()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Daily Digest</h2>
        <div className="flex gap-3">
          <button
            onClick={generateDigest}
            disabled={loading}
            className="px-5 py-2.5 bg-primary-500 text-white rounded-lg disabled:opacity-50 hover:bg-primary-600 transition-colors"
          >
            {loading ? 'Generating...' : '📋 Generate Digest'}
          </button>
          {digest && (
            <>
              <button
                onClick={openEmailModal}
                disabled={emailLoading}
                className="px-5 py-2.5 bg-green-500 text-white rounded-lg disabled:opacity-50 hover:bg-green-600 transition-colors"
              >
                📧 Email
              </button>
              <button
                onClick={exportToPDF}
                className="px-5 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              >
                📄 Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {!digest ? (
        <div className="text-center py-10 text-gray-500">
          Click "Generate Digest" to create a daily market summary.
        </div>
      ) : (
        <div id="digest-content" className="p-8 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-xl font-semibold mb-2">Daily Market Digest</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">{digest.date}</div>
          </div>
          <div className="whitespace-pre-wrap leading-relaxed text-base mb-8">
            {digest.content}
          </div>
          <div>
            <h4 className="text-base font-semibold mb-4">Key Articles</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {digest.articles.map((article, idx) => (
                <a
                  key={idx}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm hover:shadow-md transition-all"
                >
                  {article.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {showEmailModal && digest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !emailLoading && setShowEmailModal(false)}
          role="dialog"
          aria-modal
          aria-labelledby="email-modal-title"
        >
          <div
            className="w-full max-w-md p-6 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="email-modal-title" className="text-lg font-semibold mb-2">
              Send digest to your email
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Enter your email and we’ll send you today’s digest (including key articles). You can export a PDF from the Digest page.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value)
                setEmailError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendDigestEmail()
                if (e.key === 'Escape') setShowEmailModal(false)
              }}
              className="w-full px-4 py-3 mb-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#2a2a2a] text-black dark:text-white"
              autoFocus
            />
            {emailError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{emailError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                disabled={emailLoading}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendDigestEmail}
                disabled={emailLoading}
                className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {emailLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
