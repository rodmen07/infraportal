export const MONITORING_URL: string =
  (import.meta.env.VITE_MONITORING_URL as string | undefined) ?? ''

export const AI_ORCHESTRATOR_URL: string =
  (import.meta.env.VITE_AI_ORCHESTRATOR_URL as string | undefined) ?? ''

export const AUTH_SERVICE_URL: string =
  (import.meta.env.VITE_AUTH_SERVICE_URL as string | undefined) ?? ''
