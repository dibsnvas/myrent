import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { api, setSessionExpiredHandler, tokenStore } from '../api/client'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'loading' : 'anonymous'))

  const logout = useCallback(() => {
    tokenStore.clear()
    queryClient.clear()
    setUser(null)
    setStatus('anonymous')
  }, [queryClient])

  useEffect(() => setSessionExpiredHandler(logout), [logout])

  useEffect(() => {
    if (status !== 'loading') return
    api
      .get('/auth/me/')
      .then(({ data }) => {
        setUser(data)
        setStatus('authenticated')
      })
      .catch(logout)
  }, [status, logout])

  const startSession = useCallback((data) => {
    tokenStore.set({ access: data.access, refresh: data.refresh })
    setUser(data.user)
    setStatus('authenticated')
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      setUser,
      logout,
      login: (email, password) => api.post('/auth/login/', { email, password }).then(({ data }) => startSession(data)),
      register: (payload) => api.post('/auth/register/', payload).then(({ data }) => startSession(data)),
    }),
    [user, status, logout, startSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
