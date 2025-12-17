'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DeleteLinkButtonProps {
  linkId: string
}

export function DeleteLinkButton({ linkId }: DeleteLinkButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invite link?')) {
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('join_links')
      .delete()
      .eq('id', linkId)

    if (error) {
      alert('Failed to delete link: ' + error.message)
      setIsLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isLoading}
      className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
    >
      {isLoading ? '...' : 'Delete'}
    </button>
  )
}
