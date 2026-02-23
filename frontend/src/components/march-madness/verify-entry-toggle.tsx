'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'

interface VerifyEntryToggleProps {
  entryId: string
  verified: boolean
}

export function VerifyEntryToggle({ entryId, verified }: VerifyEntryToggleProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [checked, setChecked] = useState(verified)
  const router = useRouter()

  const handleToggle = async (newValue: boolean) => {
    setIsUpdating(true)
    setChecked(newValue)

    const supabase = createClient()
    const { error } = await supabase
      .from('mm_entries')
      .update({ verified: newValue })
      .eq('id', entryId)

    if (error) {
      setChecked(!newValue) // revert on error
    } else {
      router.refresh()
    }
    setIsUpdating(false)
  }

  return (
    <div className="flex items-center gap-2 w-[100px]">
      <Checkbox
        checked={checked}
        onCheckedChange={(val) => handleToggle(val === true)}
        disabled={isUpdating}
      />
      <span className={`text-xs ${checked ? 'text-green-600' : 'text-muted-foreground'}`}>
        {checked ? 'Verified' : 'Unverified'}
      </span>
    </div>
  )
}
