// ---------------------------------------------------------------------------
// SkipLink (v1.18.2 PR1): the skip-to-content link the site lacked (finding
// F11, docs/design/V1_18_UX_THEME.md section 2). It is the first focusable
// element on every route, visually hidden until focused, and moves keyboard
// focus past the repeated navigation straight to the <main id="main-content">
// landmark.
//
// The click is intercepted rather than left to the browser because the app
// uses a hash router: letting `href="#main-content"` update location.hash
// would fire a hashchange the router does not recognise and fall through to
// the home route. Intercepting keeps the address bar and route intact while
// still moving focus, and Enter on the link still fires this handler.
// ---------------------------------------------------------------------------
const MAIN_CONTENT_ID = 'main-content'

export function SkipLink() {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (typeof document === 'undefined') return
    const target = document.getElementById(MAIN_CONTENT_ID)
    if (!target) return
    target.focus()
    target.scrollIntoView({ block: 'start' })
  }

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={handleClick}
      className="sr-only rounded-lg border border-border-soft bg-surface-2 px-4 py-2 text-sm font-medium text-text-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:shadow-xl focus:shadow-black/40"
    >
      Skip to content
    </a>
  )
}
