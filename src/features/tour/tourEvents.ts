// Cross-component starter for the guided tour, in its own module so the tour
// component file only exports a component (React Fast Refresh rule).

export const TOUR_START_EVENT = 'guided-tour:start'

/** Start the guided product tour from anywhere (e.g. the home hero CTA). */
export function startGuidedTour() {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT))
}
