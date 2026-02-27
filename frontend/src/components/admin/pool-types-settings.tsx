'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface PoolTypesSettingsProps {
  initialPoolTypes: {
    bowl_buster: boolean
    squares: boolean
    golf: boolean
    march_madness: boolean
  }
}

type PoolTypeKey = 'bowl_buster' | 'squares' | 'golf' | 'march_madness'

export function PoolTypesSettings({ initialPoolTypes }: PoolTypesSettingsProps) {
  const router = useRouter()
  const [poolTypes, setPoolTypes] = useState(initialPoolTypes)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleToggle = (key: PoolTypeKey) => {
    setPoolTypes(prev => {
      const updated = { ...prev, [key]: !prev[key] }
      setHasChanges(
        updated.bowl_buster !== initialPoolTypes.bowl_buster ||
        updated.squares !== initialPoolTypes.squares ||
        updated.golf !== initialPoolTypes.golf ||
        updated.march_madness !== initialPoolTypes.march_madness
      )
      return updated
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('site_settings')
      .update({ value: poolTypes })
      .eq('key', 'enabled_pool_types')

    if (error) {
      console.error('Error saving pool types:', error)
      alert('Failed to save settings')
    } else {
      setHasChanges(false)
      router.refresh()
    }

    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="bowl_buster" className="text-base font-medium">
              Bowl Buster
            </Label>
            <p className="text-sm text-muted-foreground">
              College football bowl pick pools with margin-of-victory scoring
            </p>
          </div>
          <Switch
            id="bowl_buster"
            checked={poolTypes.bowl_buster}
            onCheckedChange={() => handleToggle('bowl_buster')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="squares" className="text-base font-medium">
              Squares
            </Label>
            <p className="text-sm text-muted-foreground">
              Football squares pools with public grid links
            </p>
          </div>
          <Switch
            id="squares"
            checked={poolTypes.squares}
            onCheckedChange={() => handleToggle('squares')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="golf" className="text-base font-medium">
              Golf Pool
            </Label>
            <p className="text-sm text-muted-foreground">
              Pick golfers by tier for PGA tournaments
            </p>
          </div>
          <Switch
            id="golf"
            checked={poolTypes.golf}
            onCheckedChange={() => handleToggle('golf')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="march_madness" className="text-base font-medium">
              March Madness Blind Draw
            </Label>
            <p className="text-sm text-muted-foreground">
              64-participant blind draw bracket pool with random team assignment
            </p>
          </div>
          <Switch
            id="march_madness"
            checked={poolTypes.march_madness}
            onCheckedChange={() => handleToggle('march_madness')}
          />
        </div>
      </div>

      {hasChanges && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )
}
