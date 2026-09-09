'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface ArchivePoolButtonProps {
  poolId: string
  poolName: string
  /** Current archive state; the button toggles it. */
  archived: boolean
}

/**
 * Icon button that archives or unarchives a pool.
 *
 * Render only for users allowed to manage the pool (commissioner / org admin);
 * RLS enforces the same rule server-side. Safe inside a card <Link>: it stops
 * the click from navigating.
 */
export function ArchivePoolButton({ poolId, poolName, archived }: ArchivePoolButtonProps) {
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const label = archived ? `Unarchive ${poolName}` : `Archive ${poolName}`

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isSaving) return

    setIsSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('pools')
      .update({ archived_at: archived ? null : new Date().toISOString() })
      .eq('id', poolId)
    setIsSaving(false)

    if (error) {
      toast.error(`Could not ${archived ? 'unarchive' : 'archive'} ${poolName}: ${error.message}`)
      return
    }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSaving}
      aria-label={label}
      title={archived ? 'Unarchive pool' : 'Archive pool'}
      className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
    >
      {archived ? (
        // Box with an up arrow: restore from archive
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" />
          <path d="M12 17v-6" />
          <path d="M9 14l3-3 3 3" />
        </svg>
      ) : (
        // Archive box
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" />
          <path d="M10 12h4" />
        </svg>
      )}
    </button>
  )
}
