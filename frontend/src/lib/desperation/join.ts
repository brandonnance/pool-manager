/**
 * Self-join vocabulary shared by the public landing page, the join API, and the
 * dashboard toggles. Pure — no DB, no React.
 */
export type JoinClosedReason = 'pool_closed' | 'self_join_off' | 'no_schedule' | 'midseason_closed' | 'season_over'

export function joinClosedMessage(reason: JoinClosedReason | null): string {
  switch (reason) {
    case 'pool_closed':
      return "This pool isn't open right now."
    case 'self_join_off':
      return "This pool isn't taking new players. Ask the commissioner to add you."
    case 'no_schedule':
      return 'The pool opens once the schedule is loaded. Check back soon.'
    case 'midseason_closed':
      return "The season is underway and this pool isn't taking new players."
    case 'season_over':
      return 'The season is over.'
    default:
      return "This pool isn't taking new players right now."
  }
}
