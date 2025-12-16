'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className={className ?? 'text-sm text-gray-600 hover:text-gray-900'}
    >
      Sign out
    </button>
  )
}
