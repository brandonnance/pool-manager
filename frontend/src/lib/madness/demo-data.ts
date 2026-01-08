// Demo data for March Madness Blind Draw testing

import type { Region, Round, DemoTeam } from './types'
import { generateSpreadFromSeeds, simulateGameScore } from './scoring'
import { getFirstRoundMatchups } from './validation'

// 64 sample college basketball teams for demo
export const DEMO_TEAMS: DemoTeam[] = [
  // East Region
  { name: 'Connecticut', abbrev: 'CONN', seed: 1, region: 'East' },
  { name: 'Iowa State', abbrev: 'ISU', seed: 2, region: 'East' },
  { name: 'Illinois', abbrev: 'ILL', seed: 3, region: 'East' },
  { name: 'Auburn', abbrev: 'AUB', seed: 4, region: 'East' },
  { name: 'San Diego State', abbrev: 'SDSU', seed: 5, region: 'East' },
  { name: 'BYU', abbrev: 'BYU', seed: 6, region: 'East' },
  { name: 'Texas', abbrev: 'TEX', seed: 7, region: 'East' },
  { name: 'FAU', abbrev: 'FAU', seed: 8, region: 'East' },
  { name: 'Northwestern', abbrev: 'NU', seed: 9, region: 'East' },
  { name: 'Drake', abbrev: 'DRKE', seed: 10, region: 'East' },
  { name: 'Duquesne', abbrev: 'DUQ', seed: 11, region: 'East' },
  { name: 'UAB', abbrev: 'UAB', seed: 12, region: 'East' },
  { name: 'Yale', abbrev: 'YALE', seed: 13, region: 'East' },
  { name: 'Morehead State', abbrev: 'MORE', seed: 14, region: 'East' },
  { name: 'Long Beach State', abbrev: 'LBSU', seed: 15, region: 'East' },
  { name: 'Stetson', abbrev: 'STET', seed: 16, region: 'East' },

  // West Region
  { name: 'North Carolina', abbrev: 'UNC', seed: 1, region: 'West' },
  { name: 'Arizona', abbrev: 'ARIZ', seed: 2, region: 'West' },
  { name: 'Baylor', abbrev: 'BAY', seed: 3, region: 'West' },
  { name: 'Alabama', abbrev: 'ALA', seed: 4, region: 'West' },
  { name: 'Saint Mary\'s', abbrev: 'SMC', seed: 5, region: 'West' },
  { name: 'Clemson', abbrev: 'CLEM', seed: 6, region: 'West' },
  { name: 'Dayton', abbrev: 'DAY', seed: 7, region: 'West' },
  { name: 'Mississippi State', abbrev: 'MSST', seed: 8, region: 'West' },
  { name: 'Michigan State', abbrev: 'MSU', seed: 9, region: 'West' },
  { name: 'Nevada', abbrev: 'NEV', seed: 10, region: 'West' },
  { name: 'New Mexico', abbrev: 'UNM', seed: 11, region: 'West' },
  { name: 'Grand Canyon', abbrev: 'GCU', seed: 12, region: 'West' },
  { name: 'Charleston', abbrev: 'COFC', seed: 13, region: 'West' },
  { name: 'Colgate', abbrev: 'COLG', seed: 14, region: 'West' },
  { name: 'Longwood', abbrev: 'LONG', seed: 15, region: 'West' },
  { name: 'Wagner', abbrev: 'WAG', seed: 16, region: 'West' },

  // South Region
  { name: 'Houston', abbrev: 'HOU', seed: 1, region: 'South' },
  { name: 'Marquette', abbrev: 'MARQ', seed: 2, region: 'South' },
  { name: 'Kentucky', abbrev: 'UK', seed: 3, region: 'South' },
  { name: 'Duke', abbrev: 'DUKE', seed: 4, region: 'South' },
  { name: 'Wisconsin', abbrev: 'WIS', seed: 5, region: 'South' },
  { name: 'Texas Tech', abbrev: 'TTU', seed: 6, region: 'South' },
  { name: 'Florida', abbrev: 'UF', seed: 7, region: 'South' },
  { name: 'Nebraska', abbrev: 'NEB', seed: 8, region: 'South' },
  { name: 'Texas A&M', abbrev: 'TAMU', seed: 9, region: 'South' },
  { name: 'Colorado', abbrev: 'COLO', seed: 10, region: 'South' },
  { name: 'NC State', abbrev: 'NCST', seed: 11, region: 'South' },
  { name: 'James Madison', abbrev: 'JMU', seed: 12, region: 'South' },
  { name: 'Vermont', abbrev: 'UVM', seed: 13, region: 'South' },
  { name: 'Oakland', abbrev: 'OAK', seed: 14, region: 'South' },
  { name: 'Western Kentucky', abbrev: 'WKU', seed: 15, region: 'South' },
  { name: 'Grambling', abbrev: 'GRAM', seed: 16, region: 'South' },

  // Midwest Region
  { name: 'Purdue', abbrev: 'PUR', seed: 1, region: 'Midwest' },
  { name: 'Tennessee', abbrev: 'TENN', seed: 2, region: 'Midwest' },
  { name: 'Creighton', abbrev: 'CREI', seed: 3, region: 'Midwest' },
  { name: 'Kansas', abbrev: 'KU', seed: 4, region: 'Midwest' },
  { name: 'Gonzaga', abbrev: 'GONZ', seed: 5, region: 'Midwest' },
  { name: 'South Carolina', abbrev: 'SC', seed: 6, region: 'Midwest' },
  { name: 'Texas State', abbrev: 'TXST', seed: 7, region: 'Midwest' },
  { name: 'Utah State', abbrev: 'USU', seed: 8, region: 'Midwest' },
  { name: 'TCU', abbrev: 'TCU', seed: 9, region: 'Midwest' },
  { name: 'Colorado State', abbrev: 'CSU', seed: 10, region: 'Midwest' },
  { name: 'Oregon', abbrev: 'ORE', seed: 11, region: 'Midwest' },
  { name: 'McNeese State', abbrev: 'MCNS', seed: 12, region: 'Midwest' },
  { name: 'Samford', abbrev: 'SAM', seed: 13, region: 'Midwest' },
  { name: 'Akron', abbrev: 'AKR', seed: 14, region: 'Midwest' },
  { name: 'Montana State', abbrev: 'MTST', seed: 15, region: 'Midwest' },
  { name: 'Saint Peter\'s', abbrev: 'SPU', seed: 16, region: 'Midwest' },
]

// Sample player names for demo entries
export const DEMO_PLAYER_NAMES = [
  'Alex Thompson', 'Jordan Smith', 'Casey Brown', 'Morgan Davis',
  'Taylor Wilson', 'Riley Johnson', 'Avery Martinez', 'Quinn Anderson',
  'Blake Thomas', 'Drew Garcia', 'Sam Robinson', 'Jamie Lee',
  'Chris Williams', 'Pat Miller', 'Cameron Jones', 'Sydney White',
  'Reese Harris', 'Parker Clark', 'Bailey Lewis', 'Jesse Walker',
  'Logan Hall', 'Peyton Young', 'Hayden King', 'Charlie Wright',
  'Dakota Scott', 'Dylan Green', 'Finley Baker', 'Emerson Adams',
  'Rowan Nelson', 'Skyler Hill', 'Sage Moore', 'Phoenix Taylor',
  'River Jackson', 'Oakley Martin', 'Eden Lee', 'Winter Garcia',
  'Storm Davis', 'Rain Wilson', 'Cloud Johnson', 'Sunny Martinez',
  'Lake Anderson', 'Forest Thomas', 'Meadow Brown', 'Brook Robinson',
  'Canyon Miller', 'Ridge Williams', 'Summit Jones', 'Valley White',
  'Harbor Harris', 'Cove Clark', 'Beach Lewis', 'Shore Walker',
  'Cliff Hall', 'Mesa Young', 'Dune King', 'Reef Wright',
  'Coral Scott', 'Pearl Green', 'Shell Baker', 'Wave Adams',
  'Tide Nelson', 'Current Hill', 'Drift Moore', 'Flow Taylor',
]

/**
 * Generate bracket matchups for Round of 64
 * Returns game setup data for all 32 first-round games
 */
export function generateRound64Games(
  teams: Array<{ id: string; seed: number; region: string }>
): Array<{
  round: Round
  region: string
  game_number: number
  higher_seed_team_id: string
  lower_seed_team_id: string
  spread: number
}> {
  const games: Array<{
    round: Round
    region: string
    game_number: number
    higher_seed_team_id: string
    lower_seed_team_id: string
    spread: number
  }> = []

  const matchups = getFirstRoundMatchups()
  const regions: Region[] = ['East', 'West', 'South', 'Midwest']

  let gameNumber = 1
  for (const region of regions) {
    const regionTeams = teams.filter(t => t.region === region)
    const teamBySeed = new Map(regionTeams.map(t => [t.seed, t]))

    for (const [higherSeed, lowerSeed] of matchups) {
      const higherTeam = teamBySeed.get(higherSeed)
      const lowerTeam = teamBySeed.get(lowerSeed)

      if (higherTeam && lowerTeam) {
        games.push({
          round: 'R64',
          region,
          game_number: gameNumber++,
          higher_seed_team_id: higherTeam.id,
          lower_seed_team_id: lowerTeam.id,
          spread: generateSpreadFromSeeds(higherSeed, lowerSeed),
        })
      }
    }
  }

  return games
}

/**
 * Simulate a round of games
 * Returns simulated scores for each game
 */
export function simulateRound(
  games: Array<{
    id: string
    spread: number | null
    higher_seed_team_id: string | null
    lower_seed_team_id: string | null
    status: string
  }>
): Array<{
  game_id: string
  higher_seed_score: number
  lower_seed_score: number
}> {
  return games
    .filter(g => g.status !== 'final' && g.higher_seed_team_id && g.lower_seed_team_id)
    .map(game => {
      const [higherScore, lowerScore] = simulateGameScore(game.spread ?? 0)
      return {
        game_id: game.id,
        higher_seed_score: higherScore,
        lower_seed_score: lowerScore,
      }
    })
}

/**
 * Get demo teams for a specific region
 */
export function getDemoTeamsByRegion(region: Region): DemoTeam[] {
  return DEMO_TEAMS.filter(t => t.region === region).sort((a, b) => a.seed - b.seed)
}

/**
 * Shuffle an array (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
