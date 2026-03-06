import { useCallback, useEffect, useMemo, useState } from 'react'
import { loginWithPassword, openOAuthPopup, registerUser, verifyToken } from '../../api/auth'
import { setApiAccessToken } from '../../api/tasks'
import type { AuthSession, AuthUserResponse } from '../../types'

const STORAGE_KEY = 'taskforge.auth.session'

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed.accessToken || !parsed.subject || !parsed.expiresAt || !parsed.userId) return null
    return parsed
  } catch {
    return null
  }
}

function persistSession(session: AuthSession | null): void {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function sessionFromResponse(resp: AuthUserResponse): AuthSession {
  return {
    subject: resp.username,
    userId: resp.user_id,
    accessToken: resp.access_token,
    roles: resp.roles,
    expiresAt: Date.now() + resp.expires_in * 1000,
  }
}

export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [subjectInput, setSubjectInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  const restoreSession = useCallback(async () => {
    setAuthLoading(true)
    setAuthError('')

    const stored = readStoredSession()
    if (!stored) {
      setApiAccessToken('')
      setSession(null)
      setAuthLoading(false)
      return
    }

    if (stored.expiresAt <= Date.now()) {
      persistSession(null)
      setApiAccessToken('')
      setSession(null)
      setAuthLoading(false)
      return
    }

    try {
      const verification = await verifyToken(stored.accessToken)
      if (!verification.active) {
        persistSession(null)
        setApiAccessToken('')
        setSession(null)
        setAuthLoading(false)
        return
      }

      setApiAccessToken(stored.accessToken)
      setSession(stored)
    } catch {
      persistSession(null)
      setApiAccessToken('')
      setSession(null)
      setAuthError('Session expired. Please sign in again.')
    } finally {
      setAuthLoading(false)
    }
  }, [])

  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  const _applySession = useCallback((nextSession: AuthSession) => {
    setApiAccessToken(nextSession.accessToken)
    persistSession(nextSession)
    setSession(nextSession)
    setSubjectInput('')
    setPasswordInput('')
  }, [])

  const signIn = useCallback(async () => {
    const username = subjectInput.trim()
    const password = passwordInput

    if (!username) {
      setAuthError('Email address is required')
      return
    }
    if (!password) {
      setAuthError('Password is required')
      return
    }

    setAuthBusy(true)
    setAuthError('')

    try {
      const resp = await loginWithPassword(username, password)
      _applySession(sessionFromResponse(resp))
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to sign in')
      setApiAccessToken('')
      persistSession(null)
      setSession(null)
    } finally {
      setAuthBusy(false)
    }
  }, [subjectInput, passwordInput, _applySession])

  const createUsername = useCallback(async () => {
    const username = subjectInput.trim()
    const password = passwordInput

    if (!username) {
      setAuthError('Email address is required')
      return
    }
    if (!password) {
      setAuthError('Password is required (min 6 characters)')
      return
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters')
      return
    }

    setAuthBusy(true)
    setAuthError('')

    try {
      const resp = await registerUser(username, password)
      _applySession(sessionFromResponse(resp))
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to create account')
      setApiAccessToken('')
      persistSession(null)
      setSession(null)
    } finally {
      setAuthBusy(false)
    }
  }, [subjectInput, passwordInput, _applySession])

  const signInWithOAuth = useCallback(async (provider: 'github' | 'google') => {
    setAuthBusy(true)
    setAuthError('')

    try {
      const resp = await openOAuthPopup(provider)
      _applySession(sessionFromResponse(resp))
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : `Failed to sign in with ${provider}`)
      setApiAccessToken('')
      persistSession(null)
      setSession(null)
    } finally {
      setAuthBusy(false)
    }
  }, [_applySession])

  const signOut = useCallback(() => {
    setApiAccessToken('')
    persistSession(null)
    setSession(null)
    setAuthError('')
    setPasswordInput('')
  }, [])

  const isAuthenticated = useMemo(
    () => Boolean(session && session.expiresAt > Date.now()),
    [session],
  )

  return {
    session,
    isAuthenticated,
    authLoading,
    authBusy,
    authError,
    subjectInput,
    setSubjectInput,
    passwordInput,
    setPasswordInput,
    signIn,
    createUsername,
    signInWithOAuth,
    signOut,
  }
}
