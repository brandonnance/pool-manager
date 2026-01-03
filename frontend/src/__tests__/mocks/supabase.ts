/**
 * Supabase mock utilities for unit testing
 *
 * Provides mock implementations of the Supabase client for testing
 * components that interact with the database.
 */

import { vi } from 'vitest'

/**
 * Mock query builder that chains Supabase query methods
 */
interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
}

/**
 * Mock realtime channel
 */
interface MockChannel {
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
}

/**
 * Create a mock Supabase client for testing
 */
export function createMockSupabaseClient() {
  // Default response for queries
  let defaultResponse: { data: unknown; error: null } | { data: null; error: { message: string } } = {
    data: null,
    error: null,
  }

  const createChainableMock = (): MockQueryBuilder => {
    const mock: MockQueryBuilder = {
      select: vi.fn().mockImplementation(() => mock),
      insert: vi.fn().mockImplementation(() => mock),
      update: vi.fn().mockImplementation(() => mock),
      delete: vi.fn().mockImplementation(() => mock),
      upsert: vi.fn().mockImplementation(() => mock),
      eq: vi.fn().mockImplementation(() => mock),
      neq: vi.fn().mockImplementation(() => mock),
      in: vi.fn().mockImplementation(() => mock),
      is: vi.fn().mockImplementation(() => mock),
      single: vi.fn().mockImplementation(() => Promise.resolve(defaultResponse)),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(defaultResponse)),
      order: vi.fn().mockImplementation(() => mock),
      limit: vi.fn().mockImplementation(() => mock),
      range: vi.fn().mockImplementation(() => mock),
    }
    return mock
  }

  const mockQueryBuilder = createChainableMock()

  const mockChannel: MockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  }

  const mockClient = {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }

  return {
    client: mockClient,
    queryBuilder: mockQueryBuilder,
    channel: mockChannel,

    /**
     * Set the default response for all queries
     */
    setDefaultResponse: (data: unknown) => {
      defaultResponse = { data, error: null }
    },

    /**
     * Set up a successful query response
     */
    mockSelectResponse: (data: unknown) => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data, error: null })
      return mockQueryBuilder
    },

    /**
     * Set up a successful insert response
     */
    mockInsertResponse: (data: unknown) => {
      mockQueryBuilder.insert.mockResolvedValueOnce({ data, error: null })
      return mockQueryBuilder
    },

    /**
     * Set up an error response
     */
    mockError: (message: string) => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message },
      })
      return mockQueryBuilder
    },

    /**
     * Reset all mocks
     */
    reset: () => {
      vi.clearAllMocks()
      defaultResponse = { data: null, error: null }
    },
  }
}

/**
 * Type for the mock Supabase client
 */
export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
