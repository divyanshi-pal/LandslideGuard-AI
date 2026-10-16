import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, tokenStore } from '../api/client'

// Shared administrator session for the whole app (header profile menu, admin pages, maps).
const AuthContext = createContext({ user: null, checking: false, isAdmin: false, login: async () => {}, logout: () => {} })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(() => Boolean(tokenStore.get()))

  useEffect(() => {
    if (!tokenStore.get()) return
    api.admin
      .me()
      .then((me) => setUser(me.username))
      .catch(() => tokenStore.clear()) // expired or invalid token
      .finally(() => setChecking(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await api.admin.login(username, password)
    tokenStore.set(res.access_token)
    setUser(res.username)
    return res
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, checking, isAdmin: Boolean(user), login, logout }), [user, checking, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
