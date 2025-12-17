'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface GenerateLinkButtonProps {
  poolId: string
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export function GenerateLinkButton({ poolId }: GenerateLinkButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [maxUses, setMaxUses] = useState<string>('')
  const [expiresIn, setExpiresIn] = useState<string>('never')

  const router = useRouter()

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    const token = generateToken()

    let expiresAt: string | null = null
    if (expiresIn === '1d') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    } else if (expiresIn === '7d') {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (expiresIn === '30d') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    const { error: insertError } = await supabase
      .from('join_links')
      .insert({
        pool_id: poolId,
        token,
        created_by: user.id,
        max_uses: maxUses ? parseInt(maxUses, 10) : null,
        expires_at: expiresAt
      })

    if (insertError) {
      setError(insertError.message)
      setIsLoading(false)
      return
    }

    const url = `${window.location.origin}/join/${token}`
    setGeneratedUrl(url)
    setIsLoading(false)
    router.refresh()
  }

  const handleCopy = async () => {
    if (generatedUrl) {
      await navigator.clipboard.writeText(generatedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setGeneratedUrl(null)
    setError(null)
    setMaxUses('')
    setExpiresIn('never')
    setCopied(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
      >
        Generate Invite Link
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={handleClose} />

            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {generatedUrl ? 'Invite Link Created!' : 'Generate Invite Link'}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}

              {generatedUrl ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Share this link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedUrl}
                        className="flex-1 px-3 py-2 border rounded-md text-sm bg-gray-50"
                      />
                      <button
                        onClick={handleCopy}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum uses (optional)
                    </label>
                    <input
                      type="number"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder="Unlimited"
                      min="1"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expires
                    </label>
                    <select
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="never">Never</option>
                      <option value="1d">In 1 day</option>
                      <option value="7d">In 7 days</option>
                      <option value="30d">In 30 days</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {isLoading ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
