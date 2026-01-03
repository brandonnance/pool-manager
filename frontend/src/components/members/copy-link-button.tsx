'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'

interface CopyLinkButtonProps {
  token: string
}

export function CopyLinkButton({ token }: CopyLinkButtonProps) {
  const [fullUrl, setFullUrl] = useState('')

  useEffect(() => {
    setFullUrl(`${window.location.origin}/join/${token}`)
  }, [token])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 gap-1">
      <Copy className="h-3 w-3" />
      Copy
    </Button>
  )
}
