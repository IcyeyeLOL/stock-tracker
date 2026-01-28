'use client'

import { useState } from 'react'
import { useStorage } from '@/hooks/useStorage'
import { SocialAccount } from '@/types'

export default function Social() {
  const [platform, setPlatform] = useState<'linkedin' | 'youtube'>('linkedin')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [followedAccounts, setFollowedAccounts] = useStorage<SocialAccount[]>('followedAccounts', [])

  const searchSocial = async () => {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    try {
      if (platform === 'linkedin') {
        const response = await fetch(`/api/social/linkedin?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        setSearchResults(data.results || [])
        if (data.message) {
          alert(data.message)
        }
      } else {
        const response = await fetch(`/api/social/youtube?q=${encodeURIComponent(searchQuery.trim())}`)
        const data = await response.json().catch(() => ({ error: 'Invalid response from server', results: [] }))
        const results = Array.isArray(data.results) ? data.results : []
        setSearchResults(results)
        if (data.error) {
          const msg = typeof data.error === 'string' ? data.error : data.message || 'YouTube search failed.'
          alert(msg)
        }
      }
    } catch (error) {
      console.error('Error searching social:', error)
      setSearchResults([])
      alert('Error searching. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const followAccount = (account: SocialAccount) => {
    const isFollowing = followedAccounts.some(
      acc => acc.id === account.id && acc.platform === account.platform
    )
    
    if (!isFollowing) {
      setFollowedAccounts([...followedAccounts, account])
    }
  }

  const unfollowAccount = (accountId: string, accountPlatform: 'linkedin' | 'youtube') => {
    setFollowedAccounts(
      followedAccounts.filter(
        acc => !(acc.id === accountId && acc.platform === accountPlatform)
      )
    )
  }

  const getLinkUrl = (account: SocialAccount) => {
    if (account.platform === 'linkedin') {
      // Use searchUrl if available (from API), otherwise construct it
      return (account as any).searchUrl || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(account.name || account.headline || searchQuery)}`
    } else {
      if (account.videoId) {
        return `https://www.youtube.com/watch?v=${account.videoId}`
      } else if (account.channelId) {
        return `https://www.youtube.com/channel/${account.channelId}`
      } else {
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(account.name || searchQuery)}`
      }
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Social Tracking</h2>
      
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setPlatform('linkedin')}
          className={`px-5 py-2.5 rounded-lg transition-colors ${
            platform === 'linkedin'
              ? 'bg-primary-500 text-white'
              : 'bg-transparent border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          LinkedIn
        </button>
        <button
          onClick={() => setPlatform('youtube')}
          className={`px-5 py-2.5 rounded-lg transition-colors ${
            platform === 'youtube'
              ? 'bg-primary-500 text-white'
              : 'bg-transparent border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          YouTube
        </button>
      </div>

      <div className="p-5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl mb-6 shadow-sm">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder={`Search ${platform === 'linkedin' ? 'LinkedIn profiles' : 'YouTube channels/videos'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchSocial()}
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#2a2a2a] text-black dark:text-white"
          />
          <button
            onClick={searchSocial}
            disabled={loading}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg disabled:opacity-50 hover:bg-primary-600 transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {followedAccounts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Following ({followedAccounts.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {followedAccounts.map((account, idx) => {
              const isFollowing = true
              return (
                <div key={idx} className="p-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <a
                        href={getLinkUrl(account)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-primary-500 hover:underline block mb-1"
                      >
                        {account.name || 'Unknown'}
                      </a>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        {account.platform === 'linkedin' ? account.headline : account.channelTitle}
                      </div>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          account.platform === 'linkedin'
                            ? 'bg-blue-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {account.platform === 'linkedin' ? 'LinkedIn' : 'YouTube'}
                      </span>
                    </div>
                    <button
                      onClick={() => unfollowAccount(account.id, account.platform)}
                      className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                    >
                      Unfollow
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {searchResults.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Search Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((result, idx) => {
              const isFollowing = followedAccounts.some(
                acc => acc.id === result.id && acc.platform === result.platform
              )
              return (
                <div key={idx} className="p-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
                  <div className="mb-3">
                    <a
                      href={getLinkUrl(result)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-semibold text-primary-500 hover:underline block mb-1"
                    >
                      {result.name || 'Unknown'}
                    </a>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {result.platform === 'linkedin' ? result.headline : result.channelTitle || result.description}
                    </div>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        result.platform === 'linkedin'
                          ? 'bg-blue-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {result.platform === 'linkedin' ? 'LinkedIn' : 'YouTube'}
                    </span>
                  </div>
                  <button
                    onClick={() => isFollowing ? unfollowAccount(result.id, result.platform) : followAccount(result)}
                    className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
                      isFollowing
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    }`}
                  >
                    {isFollowing ? '✓ Following' : '+ Follow'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
