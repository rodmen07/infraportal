import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.stubGlobal('import', { meta: { env: { BASE_URL: '/', VITE_API_URL: 'http://localhost:3000' } } })
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  it('should have BASE_URL available', () => {
    expect(import.meta.env.BASE_URL).toBeDefined()
  })

  it('should support VITE_API_URL environment variable', () => {
    expect(import.meta.env.VITE_API_URL).toBeDefined()
  })
})
