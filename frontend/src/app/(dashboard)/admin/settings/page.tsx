import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PoolTypesSettings } from '@/components/admin/pool-types-settings'
import { NflGamesSettings } from '@/components/admin/nfl-games-settings'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify super admin access
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    redirect('/dashboard')
  }

  // Get site settings
  const { data: settings } = await supabase
    .from('site_settings')
    .select('key, value')

  const poolTypes = settings?.find(s => s.key === 'pool_types')?.value as {
    bowl_buster: boolean
    playoff_squares: boolean
  } | null

  const nflPlayoffGames = settings?.find(s => s.key === 'nfl_playoff_games')?.value as Array<{
    name: string
    round: string
    display_order: number
  }> | null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Site Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure site-wide settings. Super Admin only.
        </p>
      </div>

      {/* Pool Types Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Types</CardTitle>
          <CardDescription>
            Enable or disable pool types available for creation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PoolTypesSettings
            initialPoolTypes={poolTypes ?? { bowl_buster: true, playoff_squares: true }}
          />
        </CardContent>
      </Card>

      {/* NFL Playoff Games Section */}
      <Card>
        <CardHeader>
          <CardTitle>NFL Playoff Games Template</CardTitle>
          <CardDescription>
            Configure the NFL playoff games that will be created for new Squares pools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NflGamesSettings
            initialGames={nflPlayoffGames ?? []}
          />
        </CardContent>
      </Card>
    </div>
  )
}
