import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/auth/logout-button'
import { Badge } from '@/components/ui/badge'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, is_super_admin, deactivated_at')
    .eq('id', user.id)
    .single()

  // Backup deactivation check (defense in depth)
  if (profile?.deactivated_at) {
    redirect('/account-deactivated')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-bold flex items-center gap-2">
                <span className="bg-white text-primary px-2 py-0.5 rounded font-black">BN</span>
                <span>Pools</span>
              </Link>
              <nav className="hidden md:flex space-x-1">
                <Link
                  href="/dashboard"
                  className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/orgs"
                  className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Organizations
                </Link>
                {profile?.is_super_admin && (
                  <Link
                    href="/admin/users"
                    className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Users
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm flex items-center gap-2">
                <span className="font-medium">{profile?.display_name || user.email}</span>
                {profile?.is_super_admin && (
                  <Badge variant="secondary" className="bg-accent text-accent-foreground">
                    Admin
                  </Badge>
                )}
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
