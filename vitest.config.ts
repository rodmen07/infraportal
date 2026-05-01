import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      VITE_API_URL: 'http://localhost:3000',
      VITE_AUTH_SERVICE_URL: 'http://localhost:8000',
      VITE_PROJECTS_API_BASE_URL: 'http://localhost:3015',
      VITE_CONTACTS_API_BASE_URL: 'http://localhost:3011',
      VITE_ACCOUNTS_API_BASE_URL: 'http://localhost:3010',
      VITE_OPPORTUNITIES_API_BASE_URL: 'http://localhost:3012',
      VITE_ACTIVITIES_API_BASE_URL: 'http://localhost:3013',
      VITE_AUTOMATION_API_BASE_URL: 'http://localhost:3014',
      VITE_INTEGRATIONS_API_BASE_URL: 'http://localhost:3016',
      VITE_AUDIT_API_BASE_URL: 'http://localhost:3017',
      VITE_EVENT_STREAM_URL: 'http://localhost:8085',
      VITE_SEARCH_API_BASE_URL: 'http://localhost:8083',
      VITE_REPORTING_API_BASE_URL: 'http://localhost:8086',
      VITE_OBSERVABOARD_URL: 'https://observaboard-rodmen07.fly.dev',
      VITE_SPEND_API_BASE_URL: 'http://localhost:3020',
      VITE_ADMIN_KEY: 'dev-admin',
    },
  },
})
