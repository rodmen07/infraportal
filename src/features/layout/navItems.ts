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
  { label: 'Patch Notes', href: '#/patch-notes', section: 'primary' },
  { label: 'Contact', href: '#/contact', section: 'primary' },
  { label: 'Observaboard', href: '#/observaboard', section: 'admin' },
]

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.section === 'primary')
export const WORKSPACE_NAV_ITEMS: NavItem[] = []
export const ADMIN_NAV_ITEMS = NAV_ITEMS.filter((item) => item.section === 'admin')
