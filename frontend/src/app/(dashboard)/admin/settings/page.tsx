/**
 * @fileoverview Super Admin site settings page
 * @route /admin/settings
 * @auth Super Admin only (profiles.is_super_admin = true)
 * @layout Dashboard layout with admin navigation
 *
 * @description
 * Platform-wide configuration interface for super administrators.
 * Manages global settings stored in the site_settings table.
 *
 * @features
 * - Pool Types toggle: Enable/disable pool types (bowl_buster, playoff_squares, golf, march_madness)
 * - NFL Playoff Games template: Configure default games for new Squares pools
 *
 * @components
 * - PoolTypesSettings: Toggle switches for each pool type
 * - NflGamesSettings: Manage NFL playoff game templates (add/edit/remove/reorder)
 *
 * @data_fetching
 * - site_settings: Key-value store for 'enabled_pool_types' and 'nfl_playoff_games'
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PoolTypesSettings } from '@/components/admin/pool-types-settings'
import { NflGamesSettings } from '@/components/admin/nfl-games-settings'

/**
 * Admin settings page - Server Component
 * Fetches site-wide settings and renders configuration UI.
 * Only accessible to super admins.
 */
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

  const poolTypes = settings?.find(s => s.key === 'enabled_pool_types')?.value as {
    bowl_buster: boolean
    playoff_squares: boolean
    golf: boolean
    march_madness: boolean
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
            initialPoolTypes={poolTypes ?? { bowl_buster: true, playoff_squares: true, golf: true, march_madness: true }}
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
