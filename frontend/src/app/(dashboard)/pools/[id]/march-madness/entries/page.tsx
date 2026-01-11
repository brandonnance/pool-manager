/**
 * @fileoverview March Madness entries management page
 * @route /pools/[id]/march-madness/entries
 * @auth Commissioner only
 * @layout Dashboard layout
 *
 * @description
 * Commissioner page for managing the 64 participant entries and running
 * the random team draw. Supports manual entry addition and public link
 * entry requests.
 *
 * @features
 * - Add entries manually (participant display names)
 * - Public link management for entry requests
 * - Pending request approval/denial queue
 * - Progress indicator (X/64 entries)
 * - Random draw execution (requires 64 teams + 64 entries)
 * - Draw status display with completion timestamp
 * - Approved entries table with assigned teams (post-draw)
 * - Delete entries (pre-draw only)
 * - Demo seed button for testing
 *
 * @components
 * - AddEntryDialog: Modal to add new participant name
 * - PublicLinkManager: Generate/copy/delete public entry request link
 * - EntryRequestActions: Approve/deny pending requests
 * - RandomDrawButton: Execute the blind draw (assigns teams randomly)
 * - DeleteEntryButton: Remove entry (pre-draw only)
 * - DemoSeedButton: Quick-fill entries for testing
 *
 * @data_fetching
 * - mm_pools: Draw status, public_slug
 * - mm_entries: All entries (approved + pending), with team assignments
 * - mm_pool_teams: Team count + details for assigned team display
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RandomDrawButton, AddEntryDialog, EntryRequestActions, PublicLinkManager, DemoSeedButton } from '@/components/march-madness'
import { DeleteEntryButton } from '@/components/march-madness/delete-entry-button'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * March Madness entries page - Server Component
 * Commissioner-only page for managing participants and running the draw.
 */
export default async function MarchMadnessEntriesPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get pool
  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, type, status, org_id')
    .eq('id', id)
    .single()

  if (!pool || pool.type !== 'march_madness') {
    notFound()
  }

  // Check commissioner access
  const { data: poolMembership } = await supabase
    .from('pool_memberships')
    .select('role')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .single()

  const { data: orgMembership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', pool.org_id)
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.is_super_admin ?? false
  const isOrgAdmin = orgMembership?.role === 'admin' || isSuperAdmin
  const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin

  if (!isPoolCommissioner) {
    redirect(`/pools/${id}/march-madness`)
  }

  // Get mm_pool config
  const { data: mmPool } = await supabase
    .from('mm_pools')
    .select('*')
    .eq('pool_id', id)
    .single()

  if (!mmPool) {
    notFound()
  }

  // Get all entries (including pending)
  const { data: allEntries } = await supabase
    .from('mm_entries')
    .select('*')
    .eq('mm_pool_id', mmPool.id)
    .order('created_at', { ascending: true })

  // Split into approved and pending
  const approvedEntries = allEntries?.filter(e => e.status === 'approved') ?? []
  const pendingEntries = allEntries?.filter(e => e.status === 'pending') ?? []

  // Get pool teams count
  const { count: teamCount } = await supabase
    .from('mm_pool_teams')
    .select('*', { count: 'exact', head: true })
    .eq('mm_pool_id', mmPool.id)

  // Get pool teams for team names
  const { data: poolTeams } = await supabase
    .from('mm_pool_teams')
    .select('*, bb_teams (id, name, abbrev)')
    .eq('mm_pool_id', mmPool.id)

  const teamById = new Map(poolTeams?.map(t => [t.id, t]) ?? [])

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4">
        <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
          <li>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/pools/${id}`} className="hover:text-foreground transition-colors">
              {pool.name}
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/pools/${id}/march-madness`} className="hover:text-foreground transition-colors">
              March Madness
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground font-medium">Entries</li>
        </ol>
      </nav>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Entries</h1>
          <p className="text-muted-foreground">Add participant names and run the random team draw</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={approvedEntries.length === 64 ? 'default' : 'secondary'} className="text-lg px-3 py-1">
            {approvedEntries.length} / 64
          </Badge>
          {!mmPool.draw_completed && (
            <DemoSeedButton mmPoolId={mmPool.id} variant="entries" />
          )}
          <AddEntryDialog
            mmPoolId={mmPool.id}
            currentEntryCount={approvedEntries.length}
            drawCompleted={mmPool.draw_completed}
          />
        </div>
      </div>

      {/* Public Link Manager - only show before draw */}
      {!mmPool.draw_completed && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Public Entry Requests</CardTitle>
            <CardDescription>
              Share a public link where people can request to join the pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PublicLinkManager
              mmPoolId={mmPool.id}
              currentSlug={mmPool.public_slug}
            />
          </CardContent>
        </Card>
      )}

      {/* Pending Requests */}
      {pendingEntries.length > 0 && !mmPool.draw_completed && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Pending Requests</span>
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                {pendingEntries.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Review and approve or deny entry requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.display_name || 'Unknown'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <EntryRequestActions
                          entryId={entry.id}
                          entryName={entry.display_name || 'this entry'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Draw status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Random Draw</span>
            <Badge variant={mmPool.draw_completed ? 'default' : 'secondary'}>
              {mmPool.draw_completed ? 'Completed' : 'Pending'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mmPool.draw_completed ? (
            <div>
              <p className="text-muted-foreground mb-2">
                Draw completed on {new Date(mmPool.draw_completed_at!).toLocaleDateString()}
              </p>
              <p className="text-sm text-muted-foreground">
                All 64 teams have been randomly assigned to entries.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{teamCount ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Teams Ready</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{approvedEntries.length}</p>
                  <p className="text-sm text-muted-foreground">Entries Ready</p>
                </div>
              </div>
              <RandomDrawButton
                mmPoolId={mmPool.id}
                entryCount={approvedEntries.length}
                teamCount={teamCount ?? 0}
                drawCompleted={mmPool.draw_completed}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Entries table */}
      <Card>
        <CardHeader>
          <CardTitle>Approved Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {approvedEntries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No entries yet. Add participant names to get started.
              </p>
              <AddEntryDialog
                mmPoolId={mmPool.id}
                currentEntryCount={0}
                drawCompleted={mmPool.draw_completed}
              />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Assigned Team</TableHead>
                    <TableHead>Status</TableHead>
                    {!mmPool.draw_completed && (
                      <TableHead className="w-16"></TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedEntries.map((entry, idx) => {
                    const team = entry.current_team_id ? teamById.get(entry.current_team_id) : null
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{entry.display_name || 'Unknown'}</TableCell>
                        <TableCell>
                          {team ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-muted-foreground bg-muted px-1 py-0.5 rounded">
                                #{team.seed}
                              </span>
                              <span>{team.bb_teams?.name || 'Unknown'}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Pending draw</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={entry.eliminated ? 'secondary' : 'default'}
                            className={entry.eliminated ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}
                          >
                            {entry.eliminated ? 'Eliminated' : 'Alive'}
                          </Badge>
                        </TableCell>
                        {!mmPool.draw_completed && (
                          <TableCell>
                            <DeleteEntryButton entryId={entry.id} entryName={entry.display_name || 'this entry'} />
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
