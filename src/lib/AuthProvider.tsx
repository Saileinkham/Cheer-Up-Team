import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './authContext'
import type { User } from 'firebase/auth'
import { listenAuthStateChange, signInWithEmailPassword, signOutUser } from './auth'
import { getUserAccess } from './firestore'
import type { UserRole } from '../types'

export function AuthProvider(props: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<UserRole>('staff')
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = listenAuthStateChange((u) => {
      setUser(u)
      if (!u) {
        setRole('staff')
        setIsPrimaryAdmin(false)
        setLoading(false)
        return
      }

      const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : ''
      void Promise.allSettled([u.getIdTokenResult(true), email ? getUserAccess(email) : Promise.resolve(null)])
        .then((results) => {
          if (cancelled) return
          const token = results[0].status === 'fulfilled' ? results[0].value : null
          const access = results[1].status === 'fulfilled' ? results[1].value : null

          const claimRole = token?.claims.role
          const claimAdminLegacy = token?.claims.admin === true
          const claimPrimary = token?.claims.primaryAdmin === true

          if (claimRole === 'admin' || claimRole === 'manager' || claimRole === 'staff') {
            setRole(claimRole)
          } else if (claimAdminLegacy) {
            setRole('admin')
          } else if (access?.role) {
            setRole(access.role)
          } else {
            setRole('staff')
          }

          setIsPrimaryAdmin(Boolean(claimPrimary || access?.primaryAdmin))
        })
        .catch(() => {
          if (cancelled) return
          setRole('staff')
          setIsPrimaryAdmin(false)
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
      isPrimaryAdmin,
      signInWithEmailPassword,
      signOut: signOutUser,
    }),
    [user, loading, role, isAdmin, isManager, isPrimaryAdmin],
  )

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}
