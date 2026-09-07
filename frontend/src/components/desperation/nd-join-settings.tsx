'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface Props {
  ndPoolId: string
  /** pools.status — a 'draft' pool rejects every player at the join link until opened */
  poolStatus: string
  selfJoinEnabled: boolean
  allowMidseasonJoin: boolean
}

type Patch = { self_join_enabled?: boolean; allow_midseason_join?: boolean; pool_status?: 'open' }

/**
 * Commissioner controls for the public join link: an "Open pool" step while the
 * pool is still a draft, then the toggles that decide who the link lets in.
 */
export function NdJoinSettings({ ndPoolId, poolStatus, selfJoinEnabled, allowMidseasonJoin }: Props) {
  const router = useRouter()
  const [selfJoin, setSelfJoin] = useState(selfJoinEnabled)
  const [midseason, setMidseason] = useState(allowMidseasonJoin)
  const [saving, setSaving] = useState(false)

  const save = async (patch: Patch) => {
    const prev = { selfJoin, midseason }
    if (patch.self_join_enabled !== undefined) setSelfJoin(patch.self_join_enabled)
    if (patch.allow_midseason_join !== undefined) setMidseason(patch.allow_midseason_join)
    setSaving(true)
    try {
      const res = await fetch('/api/desperation/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ndPoolId, ...patch }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not save')
      router.refresh()
    } catch (e) {
      setSelfJoin(prev.selfJoin)
      setMidseason(prev.midseason)
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border-t pt-3">
      {poolStatus === 'draft' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <div className="font-medium text-amber-900">This pool is still a draft</div>
          <p className="mt-0.5 text-xs text-amber-800">
            Anyone who opens the join link sees &ldquo;This pool isn&apos;t open right now.&rdquo; Open it before you share the link.
          </p>
          <Button size="sm" className="mt-2 w-full" disabled={saving} onClick={() => save({ pool_status: 'open' })}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />} Open pool
          </Button>
        </div>
      )}
      <Row
        id="nd-self-join"
        label="Anyone with the link can join"
        hint="Off means only players you add yourself get in. Lost-link re-sends keep working."
        checked={selfJoin}
        disabled={saving}
        onChange={(v) => save({ self_join_enabled: v })}
      />
      <Row
        id="nd-midseason"
        label="Keep joining open after Week 1"
        hint="Late joiners start with the next unplayed week and get no points for earlier weeks."
        checked={midseason}
        disabled={saving || !selfJoin}
        onChange={(v) => save({ allow_midseason_join: v })}
      />
    </div>
  )
}

function Row({ id, label, hint, checked, disabled, onChange }: {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  )
}
