/**
 * @fileoverview Admin create event page
 * @route /admin/events/create
 * @auth Super Admin only
 *
 * @description
 * Create new global events for admin-controlled scoring.
 * Supports manual entry or ESPN metadata lookup.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { CreateEventForm } from '@/components/admin/create-event-form'

export default async function AdminCreateEventPage() {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/events">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Events
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Event</h1>
        <p className="text-muted-foreground mt-1">
          Create a new global event for admin-controlled scoring
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Create Form */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>
              Enter event information or look up from ESPN
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateEventForm />
          </CardContent>
        </Card>

        {/* Help Info */}
        <Card>
          <CardHeader>
            <CardTitle>About Global Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Global events are admin-managed events that can be linked to multiple pools.
              When you score a global event, all linked pools automatically update.
            </p>

            <div>
              <h4 className="font-medium text-foreground mb-2">Supported Sports</h4>
              <ul className="list-disc ml-4 space-y-1">
                <li><strong>NFL</strong> - Pro football (admin scoring)</li>
                <li><strong>NCAAF</strong> - College football (admin scoring)</li>
                <li><strong>PGA</strong> - Golf tournaments (automated via SlashGolf API)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">Event Types</h4>
              <ul className="list-disc ml-4 space-y-1">
                <li><strong>team_game</strong> - Head-to-head matchup (NFL, NBA)</li>
                <li><strong>golf_tournament</strong> - Multi-day golf event</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">Next Steps</h4>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Create the event here</li>
                <li>Pools link to this event via pool creation</li>
                <li>When game day arrives, use Live Scoring</li>
                <li>All linked pools get winners automatically</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
