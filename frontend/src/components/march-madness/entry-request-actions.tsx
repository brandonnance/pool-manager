'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'

interface EntryRequestActionsProps {
  entryId: string
  entryName: string
}

export function EntryRequestActions({ entryId, entryName }: EntryRequestActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()

  const handleAction = async (action: 'approved' | 'denied') => {
    setIsProcessing(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('mm_entries')
      .update({ status: action })
      .eq('id', entryId)

    if (!error) {
      router.refresh()
    }
    setIsProcessing(false)
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
        onClick={() => handleAction('approved')}
        disabled={isProcessing}
        title={`Approve ${entryName}`}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
        onClick={() => handleAction('denied')}
        disabled={isProcessing}
        title={`Deny ${entryName}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
