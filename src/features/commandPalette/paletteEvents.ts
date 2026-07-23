// Cross-component opener for the command palette, kept in its own module so the
// palette component file only exports a component (React Fast Refresh rule).

export const PALETTE_OPEN_EVENT = 'command-palette:open'

/** Open the command palette from anywhere (e.g. a nav launcher button). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT))
}
