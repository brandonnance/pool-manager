// Demo data for testing golf pools without live Sportradar data

export interface DemoGolfer {
  name: string
  country: string
  owgrRank: number
  suggestedTier: number // Suggested tier based on ranking
}

// Top 50 golfers with suggested tiers based on OWGR-style rankings
export const DEMO_GOLFERS: DemoGolfer[] = [
  // Tier 0 - Elite (ranks 1-4)
  { name: 'Scottie Scheffler', country: 'USA', owgrRank: 1, suggestedTier: 0 },
  { name: 'Xander Schauffele', country: 'USA', owgrRank: 2, suggestedTier: 0 },
  { name: 'Rory McIlroy', country: 'NIR', owgrRank: 3, suggestedTier: 0 },
  { name: 'Jon Rahm', country: 'ESP', owgrRank: 4, suggestedTier: 0 },
  
  // Tier 1 - Top tier (ranks 5-10)
  { name: 'Collin Morikawa', country: 'USA', owgrRank: 5, suggestedTier: 1 },
  { name: 'Ludvig Åberg', country: 'SWE', owgrRank: 6, suggestedTier: 1 },
  { name: 'Viktor Hovland', country: 'NOR', owgrRank: 7, suggestedTier: 1 },
  { name: 'Patrick Cantlay', country: 'USA', owgrRank: 8, suggestedTier: 1 },
  { name: 'Wyndham Clark', country: 'USA', owgrRank: 9, suggestedTier: 1 },
  { name: 'Bryson DeChambeau', country: 'USA', owgrRank: 10, suggestedTier: 1 },
  
  // Tier 2 - Strong contenders (ranks 11-18)
  { name: 'Tommy Fleetwood', country: 'ENG', owgrRank: 11, suggestedTier: 2 },
  { name: 'Hideki Matsuyama', country: 'JPN', owgrRank: 12, suggestedTier: 2 },
  { name: 'Tony Finau', country: 'USA', owgrRank: 13, suggestedTier: 2 },
  { name: 'Sahith Theegala', country: 'USA', owgrRank: 14, suggestedTier: 2 },
  { name: 'Shane Lowry', country: 'IRL', owgrRank: 15, suggestedTier: 2 },
  { name: 'Russell Henley', country: 'USA', owgrRank: 16, suggestedTier: 2 },
  { name: 'Max Homa', country: 'USA', owgrRank: 17, suggestedTier: 2 },
  { name: 'Cameron Smith', country: 'AUS', owgrRank: 18, suggestedTier: 2 },
  
  // Tier 3 - Solid players (ranks 19-26)
  { name: 'Sungjae Im', country: 'KOR', owgrRank: 19, suggestedTier: 3 },
  { name: 'Matt Fitzpatrick', country: 'ENG', owgrRank: 20, suggestedTier: 3 },
  { name: 'Brian Harman', country: 'USA', owgrRank: 21, suggestedTier: 3 },
  { name: 'Jason Day', country: 'AUS', owgrRank: 22, suggestedTier: 3 },
  { name: 'Tom Kim', country: 'KOR', owgrRank: 23, suggestedTier: 3 },
  { name: 'Corey Conners', country: 'CAN', owgrRank: 24, suggestedTier: 3 },
  { name: 'Jordan Spieth', country: 'USA', owgrRank: 25, suggestedTier: 3 },
  { name: 'Justin Thomas', country: 'USA', owgrRank: 26, suggestedTier: 3 },
  
  // Tier 4 - Mid-tier (ranks 27-36)
  { name: 'Keegan Bradley', country: 'USA', owgrRank: 27, suggestedTier: 4 },
  { name: 'Sepp Straka', country: 'AUT', owgrRank: 28, suggestedTier: 4 },
  { name: 'Robert MacIntyre', country: 'SCO', owgrRank: 29, suggestedTier: 4 },
  { name: 'Cameron Young', country: 'USA', owgrRank: 30, suggestedTier: 4 },
  { name: 'Adam Scott', country: 'AUS', owgrRank: 31, suggestedTier: 4 },
  { name: 'Min Woo Lee', country: 'AUS', owgrRank: 32, suggestedTier: 4 },
  { name: 'Dustin Johnson', country: 'USA', owgrRank: 33, suggestedTier: 4 },
  { name: 'Billy Horschel', country: 'USA', owgrRank: 34, suggestedTier: 4 },
  { name: 'Chris Kirk', country: 'USA', owgrRank: 35, suggestedTier: 4 },
  { name: 'Taylor Moore', country: 'USA', owgrRank: 36, suggestedTier: 4 },
  
  // Tier 5 - Lower-mid tier (ranks 37-44)
  { name: 'Akshay Bhatia', country: 'USA', owgrRank: 37, suggestedTier: 5 },
  { name: 'Sergio Garcia', country: 'ESP', owgrRank: 38, suggestedTier: 5 },
  { name: 'Will Zalatoris', country: 'USA', owgrRank: 39, suggestedTier: 5 },
  { name: 'Tiger Woods', country: 'USA', owgrRank: 40, suggestedTier: 5 },
  { name: 'Brooks Koepka', country: 'USA', owgrRank: 41, suggestedTier: 5 },
  { name: 'Phil Mickelson', country: 'USA', owgrRank: 42, suggestedTier: 5 },
  { name: 'Rickie Fowler', country: 'USA', owgrRank: 43, suggestedTier: 5 },
  { name: 'Tyrrell Hatton', country: 'ENG', owgrRank: 44, suggestedTier: 5 },
  
  // Tier 6 - Long shots (ranks 45-50)
  { name: 'Joaquin Niemann', country: 'CHI', owgrRank: 45, suggestedTier: 6 },
  { name: 'Dean Burmester', country: 'RSA', owgrRank: 46, suggestedTier: 6 },
  { name: 'Abraham Ancer', country: 'MEX', owgrRank: 47, suggestedTier: 6 },
  { name: 'Zach Johnson', country: 'USA', owgrRank: 48, suggestedTier: 6 },
  { name: 'Davis Riley', country: 'USA', owgrRank: 49, suggestedTier: 6 },
  { name: 'Luke List', country: 'USA', owgrRank: 50, suggestedTier: 6 },
]

export const DEMO_TOURNAMENT = {
  name: 'Demo Masters 2025',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days from now
  venue: 'Augusta National Golf Club',
  courseName: 'Augusta National',
  parPerRound: 72,
}

// Generate a realistic round score around par
export function generateRoundScore(skill: number = 72): number {
  // skill is par (72) for average, lower for better players
  // Generate score with normal distribution
  const variance = 4 // Standard deviation in strokes
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  const score = Math.round(skill + z * variance)
  
  // Clamp between reasonable bounds (64-82)
  return Math.max(64, Math.min(82, score))
}

// Generate scores for a round based on tier (lower tier = better player)
export function generateTierBasedScore(tier: number): number {
  // Tier 0: skill around 69-70
  // Tier 6: skill around 73-74
  const baseSkill = 69 + (tier * 0.8)
  return generateRoundScore(baseSkill)
}

// Determine if a golfer makes the cut based on scores
export function determinesCut(r1: number, r2: number, cutLine: number = 144): boolean {
  return (r1 + r2) <= cutLine
}

// Calculate cut line based on field scores (top 50 and ties typically)
export function calculateCutLine(scores: { r1: number; r2: number }[]): number {
  const sortedTotals = scores
    .map(s => s.r1 + s.r2)
    .sort((a, b) => a - b)
  
  // Take 50th position (index 49) as cut line basis
  const cutPosition = Math.min(49, sortedTotals.length - 1)
  return sortedTotals[cutPosition] || 144 // Default to even par
}
