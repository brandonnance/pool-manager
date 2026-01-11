import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('GET /api/squares/sync-score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createRequest = (espnGameId: string | null) => {
    const url = espnGameId
      ? `http://localhost:3000/api/squares/sync-score?espnGameId=${espnGameId}`
      : 'http://localhost:3000/api/squares/sync-score'
    return new NextRequest(url)
  }

  it('should return 400 if espnGameId is missing', async () => {
    const request = createRequest(null)
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing espnGameId parameter')
  })

  it('should return 502 if ESPN API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const request = createRequest('401772981')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toBe('Failed to fetch from ESPN API')
  })

  it('should return 404 if game not found in ESPN data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          { id: '999999', name: 'Other Game', competitions: [] },
        ],
      }),
    })

    const request = createRequest('401772981')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Game 401772981 not found in ESPN data')
  })

  it('should parse scheduled game correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          {
            id: '401772981',
            name: 'Green Bay Packers at Chicago Bears',
            competitions: [
              {
                id: '401772981',
                competitors: [
                  {
                    homeAway: 'home',
                    team: { id: '3', abbreviation: 'CHI', displayName: 'Chicago Bears' },
                    score: '0',
                    linescores: [],
                  },
                  {
                    homeAway: 'away',
                    team: { id: '9', abbreviation: 'GB', displayName: 'Green Bay Packers' },
                    score: '0',
                    linescores: [],
                  },
                ],
                status: {
                  clock: 0,
                  displayClock: '0:00',
                  period: 0,
                  type: { id: '1', name: 'STATUS_SCHEDULED', description: 'Scheduled' },
                },
              },
            ],
          },
        ],
      }),
    })

    const request = createRequest('401772981')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.status).toBe('scheduled')
    expect(data.homeTeam).toBe('Chicago Bears')
    expect(data.awayTeam).toBe('Green Bay Packers')
  })

  it('should parse in-progress game correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          {
            id: '401772981',
            name: 'Green Bay Packers at Chicago Bears',
            competitions: [
              {
                id: '401772981',
                competitors: [
                  {
                    homeAway: 'home',
                    team: { id: '3', abbreviation: 'CHI', displayName: 'Chicago Bears' },
                    score: '14',
                    linescores: [
                      { value: 7, period: 1 },
                      { value: 7, period: 2 },
                    ],
                  },
                  {
                    homeAway: 'away',
                    team: { id: '9', abbreviation: 'GB', displayName: 'Green Bay Packers' },
                    score: '21',
                    linescores: [
                      { value: 14, period: 1 },
                      { value: 7, period: 2 },
                    ],
                  },
                ],
                status: {
                  clock: 120,
                  displayClock: '2:00',
                  period: 3,
                  type: { id: '2', name: 'STATUS_IN_PROGRESS', description: 'In Progress' },
                },
              },
            ],
          },
        ],
      }),
    })

    const request = createRequest('401772981')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.status).toBe('in_progress')
    expect(data.homeScore).toBe(14)
    expect(data.awayScore).toBe(21)
    expect(data.period).toBe(3)
    expect(data.clock).toBe('2:00')
    expect(data.halftimeHomeScore).toBe(14) // 7 + 7
    expect(data.halftimeAwayScore).toBe(21) // 14 + 7
    expect(data.q1HomeScore).toBe(7)
    expect(data.q1AwayScore).toBe(14)
  })

  it('should parse final game correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          {
            id: '401772981',
            name: 'Green Bay Packers at Chicago Bears',
            competitions: [
              {
                id: '401772981',
                competitors: [
                  {
                    homeAway: 'home',
                    team: { id: '3', abbreviation: 'CHI', displayName: 'Chicago Bears' },
                    score: '24',
                    linescores: [
                      { value: 7, period: 1 },
                      { value: 10, period: 2 },
                      { value: 0, period: 3 },
                      { value: 7, period: 4 },
                    ],
                  },
                  {
                    homeAway: 'away',
                    team: { id: '9', abbreviation: 'GB', displayName: 'Green Bay Packers' },
                    score: '28',
                    linescores: [
                      { value: 14, period: 1 },
                      { value: 7, period: 2 },
                      { value: 7, period: 3 },
                      { value: 0, period: 4 },
                    ],
                  },
                ],
                status: {
                  clock: 0,
                  displayClock: '0:00',
                  period: 4,
                  type: { id: '3', name: 'STATUS_FINAL', description: 'Final' },
                },
              },
            ],
          },
        ],
      }),
    })

    const request = createRequest('401772981')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.status).toBe('final')
    expect(data.homeScore).toBe(24)
    expect(data.awayScore).toBe(28)
    expect(data.halftimeHomeScore).toBe(17) // 7 + 10
    expect(data.halftimeAwayScore).toBe(21) // 14 + 7
    expect(data.q3HomeScore).toBe(17) // 7 + 10 + 0
    expect(data.q3AwayScore).toBe(28) // 14 + 7 + 7
  })

  it('should handle overtime final correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          {
            id: '401772981',
            name: 'Green Bay Packers at Chicago Bears',
            competitions: [
              {
                id: '401772981',
                competitors: [
                  {
                    homeAway: 'home',
                    team: { id: '3', abbreviation: 'CHI', displayName: 'Chicago Bears' },
                    score: '31',
                    linescores: [],
                  },
                  {
                    homeAway: 'away',
                    team: { id: '9', abbreviation: 'GB', displayName: 'Green Bay Packers' },
                    score: '28',
                    linescores: [],
                  },
                ],
                status: {
                  clock: 0,
                  displayClock: '0:00',
                  period: 5,
                  type: { id: '3', name: 'STATUS_FINAL_OVERTIME', description: 'Final/OT' },
                },
              },
            ],
          },
        ],
      }),
    })

    const request = createRequest('401772981')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('final')
  })

  it('should detect halftime correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          {
            id: '401772981',
            name: 'Green Bay Packers at Chicago Bears',
            competitions: [
              {
                id: '401772981',
                competitors: [
                  {
                    homeAway: 'home',
                    team: { id: '3', abbreviation: 'CHI', displayName: 'Chicago Bears' },
                    score: '14',
                    linescores: [
                      { value: 7, period: 1 },
                      { value: 7, period: 2 },
                    ],
                  },
                  {
                    homeAway: 'away',
                    team: { id: '9', abbreviation: 'GB', displayName: 'Green Bay Packers' },
                    score: '10',
                    linescores: [
                      { value: 3, period: 1 },
                      { value: 7, period: 2 },
                    ],
                  },
                ],
                status: {
                  clock: 0,
                  displayClock: '0:00',
                  period: 2,
                  type: { id: '2', name: 'STATUS_HALFTIME', description: 'Halftime' },
                },
              },
            ],
          },
        ],
      }),
    })

    const request = createRequest('401772981')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isHalftime).toBe(true)
    expect(data.status).toBe('in_progress')
    expect(data.halftimeHomeScore).toBe(14)
    expect(data.halftimeAwayScore).toBe(10)
  })
})
