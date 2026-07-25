// Recovery destinations shown on NotFoundPage. Kept in its own module (not in
// NotFoundPage.tsx) so a test can import and assert every href resolves to a
// real, publicly viewable route without tripping the repo's
// react-refresh/only-export-components rule. Each href must be a route the
// router in src/main.tsx handles AND one a logged-out visitor can view, so the
// 404 page never dead-ends into a login gate.
export interface RecoveryLink {
  label: string
  href: string
  variant: 'accent' | 'neutral'
}

export const NOT_FOUND_RECOVERY_LINKS: RecoveryLink[] = [
  { label: 'Back to home', href: '#/', variant: 'accent' },
  { label: 'Browse case studies', href: '#/case-studies', variant: 'neutral' },
  { label: 'Platform status', href: '#/status', variant: 'neutral' },
  { label: 'Contact', href: '#/contact', variant: 'neutral' },
]
