export interface SiteContent {
  title: string
  subtitle: string
  heroTagline?: string
}

export interface HomeSectionCard {
  heading: string
  body: string
  image?: string
  link?: string
}

export interface HomeSectionsContent {
  title: string
  cards: HomeSectionCard[]
}

// Consulting types

export interface ServiceItem {
  title: string
  description: string
  tags: string[]
}

export interface ServicesContent {
  intro: string
  services: ServiceItem[]
}

export interface CaseStudy {
  title: string
  subtitle: string
  description: string
  techStack: string[]
  highlights: string[]
  githubUrl?: string
  detailUrl?: string
}

export interface CaseStudiesContent {
  intro: string
  featured: CaseStudy
  others: CaseStudy[]
}

export interface PricingTier {
  tier: string
  price: string
  description: string
  features: string[]
  highlighted: boolean
  ctaLabel: string
  ctaHref: string
}

export interface PricingContent {
  note: string
  tiers: PricingTier[]
}

// Keyboard shortcuts
export interface RegisteredShortcut {
  keys: string
  description: string
  scope: string
  callback: () => void
  allowInInput?: boolean
}

export interface ShortcutsContextType {
  shortcuts: RegisteredShortcut[]
  registerShortcut: (shortcut: RegisteredShortcut) => () => void
}
