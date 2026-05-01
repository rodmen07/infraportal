import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, PRIMARY_NAV_ITEMS, WORKSPACE_NAV_ITEMS, ADMIN_NAV_ITEMS } from './navItems'

describe('navItems', () => {
  describe('NAV_ITEMS', () => {
    it('should contain all navigation items', () => {
      expect(NAV_ITEMS.length).toBeGreaterThan(0)
    })

    it('should have label and href for each item', () => {
      NAV_ITEMS.forEach((item) => {
        expect(item.label).toBeTruthy()
        expect(item.href).toBeTruthy()
        expect(item.section).toBeTruthy()
      })
    })

    it('should have valid sections', () => {
      const validSections = ['primary', 'admin']
      NAV_ITEMS.forEach((item) => {
        expect(validSections).toContain(item.section)
      })
    })
  })

  describe('PRIMARY_NAV_ITEMS', () => {
    it('should filter only primary items', () => {
      expect(PRIMARY_NAV_ITEMS.length).toBeGreaterThan(0)
      PRIMARY_NAV_ITEMS.forEach((item) => {
        expect(item.section).toBe('primary')
      })
    })

    it('should include Home, About, Services, Contact', () => {
      const labels = PRIMARY_NAV_ITEMS.map((item) => item.label)
      expect(labels).toContain('Home')
      expect(labels).toContain('About')
      expect(labels).toContain('Services')
      expect(labels).toContain('Contact')
    })

    it('should NOT include Workspace items', () => {
      const labels = PRIMARY_NAV_ITEMS.map((item) => item.label)
      expect(labels).not.toContain('Search')
      expect(labels).not.toContain('Portal')
      expect(labels).not.toContain('Dashboard')
    })

    it('should NOT include Status item', () => {
      const labels = PRIMARY_NAV_ITEMS.map((item) => item.label)
      expect(labels).not.toContain('Status')
    })
  })

  describe('WORKSPACE_NAV_ITEMS', () => {
    it('should be empty after cleanup', () => {
      expect(WORKSPACE_NAV_ITEMS.length).toBe(0)
    })
  })

  describe('ADMIN_NAV_ITEMS', () => {
    it('should filter only admin items', () => {
      ADMIN_NAV_ITEMS.forEach((item) => {
        expect(item.section).toBe('admin')
      })
    })

    it('should include Observaboard', () => {
      const labels = ADMIN_NAV_ITEMS.map((item) => item.label)
      expect(labels).toContain('Observaboard')
    })
  })

  describe('section filtering', () => {
    it('should have no overlap between sections', () => {
      const primaryLabels = new Set(PRIMARY_NAV_ITEMS.map((item) => item.label))
      const adminLabels = new Set(ADMIN_NAV_ITEMS.map((item) => item.label))

      primaryLabels.forEach((label) => {
        expect(adminLabels.has(label)).toBe(false)
      })
    })

    it('should cover all NAV_ITEMS', () => {
      const allFiltered = new Set([
        ...PRIMARY_NAV_ITEMS.map((item) => item.label),
        ...WORKSPACE_NAV_ITEMS.map((item) => item.label),
        ...ADMIN_NAV_ITEMS.map((item) => item.label),
      ])

      NAV_ITEMS.forEach((item) => {
        expect(allFiltered.has(item.label)).toBe(true)
      })
    })
  })
})
