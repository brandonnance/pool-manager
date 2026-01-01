'use client'

import { useState, useEffect } from 'react'

interface CopyLinkButtonProps {
  token: string
}

export function CopyLinkButton({ token }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const [fullUrl, setFullUrl] = useState('')

  useEffect(() => {
    // Construct full URL on client side
    setFullUrl(`${window.location.origin}/join/${token}`)
  }, [token])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
