import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'
import type { UserRole } from '../types'

export type AuthContextValue = {
  user: User | null
  loading: boolean
  role: UserRole
  isAdmin: boolean
  isManager: boolean
  isPrimaryAdmin: boolean
  signInWithEmailPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
