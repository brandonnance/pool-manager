/**
 * Pool card shown in an organization's pool grid.
 *
 * Server-compatible (no hooks). Embeds the client-side delete and
 * archive controls, which stop propagation so the card link stays usable.
 */
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DeletePoolButton } from '@/components/pools/delete-pool-button'
import { ArchivePoolButton } from '@/components/pools/archive-pool-button'
import { canArchive, isArchived } from '@/lib/pools/archive'
import { checkPoolCommissioner } from '@/lib/permissions'

export interface OrgPoolCardPool {
  id: string
  name: string
  type: string
  status: string
  season_label: string | null
  archived_at: string | null
  pool_memberships: { id: string; user_id: string; status: string; role: string }[] | null
}

interface OrgPoolCardProps {
  pool: OrgPoolCardPool
  orgId: string
  userId: string
  isOrgAdmin: boolean
}

const POOL_TYPE_LABELS: Record<string, string> = {
  squares: 'Squares',
  golf: 'Golf',
  march_madness: 'March Madness',
  nfl_desperation: 'NFL Desperation',
}

export function OrgPoolCard({ pool, orgId, userId, isOrgAdmin }: OrgPoolCardProps) {
  const myMembership = pool.pool_memberships?.find((pm) => pm.user_id === userId)
  const poolMemberCount = pool.pool_memberships?.filter((pm) => pm.status === 'approved').length ?? 0
  const pendingCount = pool.pool_memberships?.filter((pm) => pm.status === 'pending').length ?? 0
  // Pool commissioner = explicit pool role OR org admin (implicit rights)
  const isPoolCommissioner = checkPoolCommissioner(myMembership, isOrgAdmin)
  const archived = isArchived(pool)
  const showArchiveControl = isPoolCommissioner && (archived || canArchive(pool))
  const showDeleteControl = isOrgAdmin
  const controlCount = Number(showArchiveControl) + Number(showDeleteControl)

  const poolTypeLabel = POOL_TYPE_LABELS[pool.type] ?? pool.type

  return (
    <Link href={`/pools/${pool.id}`} className="block group">
      <Card
        className={`h-full transition-all duration-200 hover:shadow-md hover:border-primary/20 relative overflow-visible ${
          archived ? 'bg-muted/30' : ''
        }`}
      >
        {/* iPhone-style notification badge */}
        {isPoolCommissioner && pendingCount > 0 && (
          <div className="absolute -top-2 -left-2 z-10">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white shadow-sm ring-2 ring-background">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          </div>
        )}

        {/* Archive (commissioners) and delete (org admins) controls */}
        {controlCount > 0 && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
            {showArchiveControl && (
              <ArchivePoolButton poolId={pool.id} poolName={pool.name} archived={archived} />
            )}
            {showDeleteControl && (
              <DeletePoolButton
                poolId={pool.id}
                poolName={pool.name}
                poolType={pool.type}
                orgId={orgId}
              />
            )}
          </div>
        )}

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle
              className={`text-base group-hover:text-primary transition-colors ${
                controlCount === 2 ? 'pr-16' : controlCount === 1 ? 'pr-8' : ''
              }`}
            >
              {pool.name}
            </CardTitle>
          </div>
          <CardDescription>
            {poolTypeLabel}
            {pool.season_label && ` · ${pool.season_label}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {poolMemberCount} member{poolMemberCount !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              {isPoolCommissioner ? (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  Commissioner
                </Badge>
              ) : myMembership ? (
                <Badge
                  variant={myMembership.status === 'approved' ? 'secondary' : 'outline'}
                  className={`text-[10px] px-1.5 py-0 ${
                    myMembership.status === 'pending' ? 'border-yellow-500 text-yellow-600' : ''
                  }`}
                >
                  {myMembership.status === 'approved' ? 'Joined' : 'Pending'}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Not a member</span>
              )}
              {archived && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/40 text-muted-foreground">
                  Archived
                </Badge>
              )}
              <Badge
                variant={
                  pool.status === 'open' ? 'default' :
                  pool.status === 'completed' ? 'secondary' :
                  'outline'
                }
                className={`text-[10px] px-1.5 py-0 ${
                  pool.status === 'open' ? 'bg-green-600' :
                  pool.status === 'draft' ? 'border-yellow-500 text-yellow-600' :
                  ''
                }`}
              >
                {pool.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
