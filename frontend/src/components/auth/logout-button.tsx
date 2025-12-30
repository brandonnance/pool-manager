'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleLogout}
      className="bg-white/20 text-primary-foreground hover:bg-white/30 border-0"
    >
      Sign out
    </Button>
  )
}
