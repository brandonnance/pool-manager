/**
 * Round configuration for different squares event types.
 * Used by playoff-content.tsx and public-realtime-games.tsx to avoid
 * hardcoding NFL-specific round labels, colors, and hierarchies.
 */

export interface RoundConfig {
  /** Ordered list of round keys for this event type */
  roundOrder: string[]
  /** Human-readable labels for each round */
  roundLabels: Record<string, string>
  /** Short abbreviations for leaderboard display */
  roundAbbrevs: Record<string, string>
  /** Numeric hierarchy for winner square priority (higher = more important) */
  roundHierarchy: Record<string, number>
}

export function getRoundConfig(eventType: string): RoundConfig {
  if (eventType === 'march_madness') {
    return {
      roundOrder: ['mm_r64', 'mm_r32', 'mm_s16', 'mm_e8', 'mm_f4', 'mm_final'],
      roundLabels: {
        mm_r64: 'Round of 64',
        mm_r32: 'Round of 32',
        mm_s16: 'Sweet 16',
        mm_e8: 'Elite 8',
        mm_f4: 'Final Four',
        mm_final: 'Championship',
      },
      roundAbbrevs: {
        mm_r64: 'R64',
        mm_r32: 'R32',
        mm_s16: 'S16',
        mm_e8: 'E8',
        mm_f4: 'F4',
        mm_final: 'F',
      },
      roundHierarchy: {
        mm_r64: 1,
        mm_r32: 2,
        mm_s16: 3,
        mm_e8: 4,
        mm_f4: 5,
        mm_final: 6,
      },
    }
  }

  // Default: NFL Playoffs
  return {
    roundOrder: ['wild_card', 'divisional', 'conference', 'super_bowl'],
    roundLabels: {
      wild_card: 'Wild Card',
      divisional: 'Divisional',
      conference: 'Conference',
      super_bowl: 'Super Bowl',
    },
    roundAbbrevs: {
      wild_card: 'WC',
      divisional: 'D',
      conference: 'C',
      super_bowl_halftime: 'SBH',
      super_bowl: 'SB',
    },
    roundHierarchy: {
      wild_card: 1,
      divisional: 2,
      conference: 3,
      super_bowl_halftime: 4,
      super_bowl: 5,
    },
  }
}

/** Get a round label from config, with fallback */
export function getRoundLabel(eventType: string, round: string): string {
  const config = getRoundConfig(eventType)
  return config.roundLabels[round] ?? round
}

/** Format round wins as compact string (e.g., "1WC, 2D, 1C" or "3R64, 1S16") */
export function formatRoundWins(
  eventType: string,
  roundWins: Record<string, number>
): string {
  const config = getRoundConfig(eventType)
  const parts: string[] = []
  // Use roundOrder + halftime variants to ensure consistent ordering
  const allKeys = [...config.roundOrder]
  // Add halftime variant for super_bowl
  if (eventType !== 'march_madness') {
    const sbIndex = allKeys.indexOf('super_bowl')
    if (sbIndex >= 0) {
      allKeys.splice(sbIndex, 0, 'super_bowl_halftime')
    }
  }
  for (const round of allKeys) {
    const count = roundWins[round]
    if (count && count > 0) {
      const abbrev = config.roundAbbrevs[round] ?? round
      parts.push(`${count}${abbrev}`)
    }
  }
  return parts.join(', ')
}
