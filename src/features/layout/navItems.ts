export type NavItem = {
  label: string
  href: string
  scrollTo?: string
  section: 'primary' | 'admin'
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '#/', section: 'primary' },
  { label: 'About', href: '#/about', section: 'primary' },
  { label: 'Services', href: '#/services', section: 'primary' },
  { label: 'Case Studies', href: '#/case-studies', section: 'primary' },
  { label: 'Pricing', href: '#/pricing', section: 'primary' },
  { label: 'Contact', href: '#/contact', section: 'primary' },
  // Restored for v1.17.1 (was pruned in the 2026-06-26 pivot). Kept after the
  // funnel entries so the consulting funnel order is unchanged.
  { label: 'API Docs', href: '#/api-docs', section: 'primary' },
  { label: 'Consultations', href: '#/admin/consultations', section: 'admin' },
  { label: 'Support queue', href: '#/admin/support', section: 'admin' },
  { label: 'Observaboard', href: '#/observaboard', section: 'admin' },
]

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.section === 'primary')
export const WORKSPACE_NAV_ITEMS: NavItem[] = []
export const ADMIN_NAV_ITEMS = NAV_ITEMS.filter((item) => item.section === 'admin')
