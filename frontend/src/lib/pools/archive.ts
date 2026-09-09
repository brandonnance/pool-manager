/**
 * Pool archiving helpers.
 *
 * Archiving is a shelving flag (`pools.archived_at`) independent of lifecycle
 * `status`. Archived pools are hidden from the dashboard and from the default
 * org listing, but remain fully accessible by direct link.
 */

export interface ArchiveFlag {
  archived_at: string | null
}

export interface ArchivablePool extends ArchiveFlag {
  status: string
}

/** True when the pool has been shelved. */
export function isArchived(pool: ArchiveFlag): boolean {
  return pool.archived_at !== null
}

/** Only completed pools that are not already archived can be archived from the UI. */
export function canArchive(pool: ArchivablePool): boolean {
  return pool.status === 'completed' && !isArchived(pool)
}

/** Split a pool list into active and archived, preserving order. */
export function partitionArchived<T extends ArchiveFlag>(
  pools: T[] | null | undefined
): { active: T[]; archived: T[] } {
  const active: T[] = []
  const archived: T[] = []
  for (const pool of pools ?? []) {
    ;(isArchived(pool) ? archived : active).push(pool)
  }
  return { active, archived }
}
