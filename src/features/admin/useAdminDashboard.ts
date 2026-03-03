import { useCallback, useEffect, useState } from 'react'
import {
  getAdminMetrics,
  getAdminRequestLogs,
  getAdminUserActivity,
} from '../../api/tasks'
import type { AdminMetrics, AdminRequestLog, AdminUserActivity } from '../../types'

export function useAdminDashboard(enabled: boolean) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [requestLogs, setRequestLogs] = useState<AdminRequestLog[]>([])
  const [userActivity, setUserActivity] = useState<AdminUserActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadAdminData = useCallback(async () => {
    if (!enabled) {
      setMetrics(null)
      setRequestLogs([])
      setUserActivity([])
      setLoading(false)
      setError('')
      return
    }

    setLoading(true)
    setError('')

    try {
      const [nextMetrics, nextRequestLogs, nextUserActivity] = await Promise.all([
        getAdminMetrics(),
        getAdminRequestLogs(12),
        getAdminUserActivity(12),
      ])

      setMetrics(nextMetrics)
      setRequestLogs(Array.isArray(nextRequestLogs) ? nextRequestLogs : [])
      setUserActivity(Array.isArray(nextUserActivity) ? nextUserActivity : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void loadAdminData()
  }, [loadAdminData])

  return {
    metrics,
    requestLogs,
    userActivity,
    loading,
    error,
    loadAdminData,
  }
}
