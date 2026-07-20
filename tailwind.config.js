/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // v1.18.1 PR1 token foundation: mapped from the CSS custom properties
      // in src/styles/tokens.css so utilities like bg-surface-1,
      // border-border-soft, and text-text-muted resolve per-theme via
      // var(...). See docs/design/V1_18_UX_THEME.md section 5 (v1.18.1) and
      // section 7 (D4). Radius and font-size keys are deliberately namespaced
      // (radius-*, scale-*) instead of reusing Tailwind's default sm/md/lg/xl
      // keys, so this mapping cannot silently reflow the ~50 existing
      // rounded-* / text-* call sites across the app; that migration is the
      // v1.18.4 typography/consolidation milestone's job, not this one.
      colors: {
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
        },
        border: {
          soft: 'var(--border-soft)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          contrast: 'var(--accent-contrast)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        'radius-sm': 'var(--radius-sm)',
        'radius-md': 'var(--radius-md)',
        'radius-lg': 'var(--radius-lg)',
        'radius-xl': 'var(--radius-xl)',
      },
      fontSize: {
        'scale-2xs': 'var(--text-2xs)',
        'scale-xs': 'var(--text-xs)',
        'scale-sm': 'var(--text-sm)',
        'scale-base': 'var(--text-base)',
        'scale-md': 'var(--text-md)',
        'scale-lg': 'var(--text-lg)',
        'scale-xl': 'var(--text-xl)',
        'scale-2xl': 'var(--text-2xl)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'slide-in-right': 'slide-in-right 0.4s ease-out both',
      },
    },
  },
  plugins: [],
}
