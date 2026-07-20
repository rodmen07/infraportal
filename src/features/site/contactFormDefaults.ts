// v1.18.3 (D9, contact-form shortening): shared between ContactCTA.tsx and
// its tests. Kept in its own module (not exported from ContactCTA.tsx
// itself) because eslint-plugin-react-refresh's only-export-components rule
// flags a component file that also exports a non-primitive constant like
// this array.
export const WHAT_YOU_NEED_OPTIONS = ['Not sure yet', 'Architecture review', 'Launch sprint', 'Monthly retainer', 'Security review']
export const DEFAULT_TIMELINE = 'Not specified'
