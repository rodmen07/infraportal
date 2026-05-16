import { useState, useCallback, useRef, useEffect, ReactNode } from 'react'
import { ToastContext } from './ToastContext'
import { Toaster } from './Toaster'
import type { Toast, ToastVariant, ToastAction, ToastPromiseOptions, ToastContextType } from '../../types'

interface ToastProviderProps {
  children: ReactNode
}

let toastId = 0

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({})

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id])
      delete timeoutsRef.current[id]
    }
  }, [])

  const addToast = useCallback(
    (message: string, variant: ToastVariant, options?: { duration?: number; action?: ToastAction }) => {
      const id = `toast-${++toastId}`
      const duration = options?.duration ?? 5000

      const newToast: Toast = {
        id,
        message,
        variant,
        duration,
        action: options?.action,
        isLoading: false,
      }

      setToasts(prev => [...prev, newToast])

      if (duration !== Infinity) {
        const timeout = setTimeout(() => {
          removeToast(id)
        }, duration)
        timeoutsRef.current[id] = timeout
      }

      return id
    },
    [removeToast]
  )

  const promise = useCallback(
    async <T,>(promiseOrFn: Promise<T>, messages: ToastPromiseOptions): Promise<T> => {
      const id = `toast-${++toastId}`

      // Show loading toast
      const loadingToast: Toast = {
        id,
        message: messages.loading,
        variant: 'info',
        duration: Infinity,
        isLoading: true,
      }

      setToasts(prev => [...prev, loadingToast])

      try {
        const result = await promiseOrFn

        // Replace with success toast
        setToasts(prev =>
          prev.map(t =>
            t.id === id
              ? {
                  ...t,
                  message: messages.success,
                  variant: 'success' as ToastVariant,
                  isLoading: false,
                }
              : t
          )
        )

        // Auto-dismiss success after 5s
        const timeout = setTimeout(() => {
          removeToast(id)
        }, 5000)
        timeoutsRef.current[id] = timeout

        return result
      } catch (error) {
        // Replace with error toast
        setToasts(prev =>
          prev.map(t =>
            t.id === id
              ? {
                  ...t,
                  message: messages.error,
                  variant: 'error' as ToastVariant,
                  isLoading: false,
                }
              : t
          )
        )

        // Auto-dismiss error after 7s
        const timeout = setTimeout(() => {
          removeToast(id)
        }, 7000)
        timeoutsRef.current[id] = timeout

        throw error
      }
    },
    [removeToast]
  )

  const contextValue: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    promise,
  }

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout))
    }
  }, [])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Toaster toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}
