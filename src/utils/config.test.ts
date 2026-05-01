import { describe, expect, it } from 'vitest'

describe('config', () => {
  it('should have BASE_URL available', () => {
    expect(import.meta.env.BASE_URL).toBeDefined()
  })

  it('should support VITE_API_URL environment variable', () => {
    expect(import.meta.env.VITE_API_URL).toBeDefined()
    expect(import.meta.env.VITE_API_URL).toBe('http://localhost:3000')
  })
})
