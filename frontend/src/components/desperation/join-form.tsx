'use client'

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  slug: string
  /** join: new players welcome (name field shown). resend: only re-sends existing links. */
  mode: 'join' | 'resend'
}

/**
 * One form, two outcomes, identical confirmation: new emails get an entry and
 * their link; known emails get their link re-sent. The link itself is never
 * shown on screen.
 */
export function JoinForm({ slug, mode }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setState('sending')
    setError(null)
    try {
      const res = await fetch('/api/desperation/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email, displayName: mode === 'join' ? name : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong. Try again.')
        setState('idle')
        return
      }
      setState('sent')
    } catch {
      setError('Network error. Try again.')
      setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium"><Mail className="size-4" /> Check your inbox</div>
        <p className="mt-1 text-muted-foreground">
          {mode === 'join' ? 'Your private link is on its way to' : 'If that email is in the pool, your link is on its way to'}{' '}
          <span className="font-medium text-foreground">{email}</span>. Check spam if it doesn&apos;t show up within a minute.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Input
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {mode === 'join' && (
        <Input
          type="text"
          autoComplete="name"
          maxLength={40}
          placeholder="Name shown on the board (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}
      <Button type="submit" className="w-full" disabled={state === 'sending'}>
        {state === 'sending' ? <Loader2 className="size-4 animate-spin" /> : mode === 'join' ? 'Send me my link' : 'Email me my link'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
