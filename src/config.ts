const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim()

if (import.meta.env.PROD && configuredApiBaseUrl.length === 0) {
  throw new Error('VITE_API_BASE_URL is required in production builds')
}

const configuredTimeoutRaw = Number(import.meta.env.VITE_API_TIMEOUT_MS)

export const API_TIMEOUT_MS =
  Number.isFinite(configuredTimeoutRaw) && configuredTimeoutRaw >= 1000
    ? Math.min(configuredTimeoutRaw, 120000)
    : 10000

export const API_BASE_URL =
  configuredApiBaseUrl.length > 0 ? configuredApiBaseUrl : 'http://localhost:3000'
