import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './authContext'
import type { User } from 'firebase/auth'
import { listenAuthStateChange, signInWithEmailPassword, signOutUser } from './auth'

export function AuthProvider(props: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'admin' | 'manager' | 'staff'>('staff')

  useEffect(() => {
    let cancelled = false
    const unsubscribe = listenAuthStateChange((u) => {
      setUser(u)
      if (!u) {
        setRole('staff')
        setLoading(false)
        return
      }

      void u
        .getIdTokenResult(true)
        .then((result) => {
          if (cancelled) return
          const claimRole = result.claims.role
          if (claimRole === 'admin' || claimRole === 'manager' || claimRole === 'staff') {
            setRole(claimRole)
          } else if (result.claims.admin === true) {
            setRole('admin')
          } else {
            setRole('staff')
          }
        })
        .catch(() => {
          if (cancelled) return
          setRole('staff')
        })
        .finally(() => {
          if (cancelled) return
          setLoading(false)
        })
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const isAdmin = role === 'admin'
  const isManager = role === 'admin' || role === 'manager'

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      role,
      isAdmin,
      isManager,
      signInWithEmailPassword,
      signOut: signOutUser,
    }),
    [user, loading, role, isAdmin, isManager],
  )

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}
