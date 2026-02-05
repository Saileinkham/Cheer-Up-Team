import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
  getAuth,
} from 'firebase/auth'
import { getFirebase } from './firebase'

export type AuthState = {
  user: User | null
  loading: boolean
}

const googleProvider = new GoogleAuthProvider()

export function getAuthClient() {
  return getAuth(getFirebase().app)
}

export function listenAuthStateChange(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(getAuthClient(), cb)
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(getAuthClient(), googleProvider)
}

export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  const raw = email.trim()
  if (!raw || !password) return
  const e = raw.includes('@') ? raw : `${raw.toLowerCase()}@ohkajhu.local`
  await signInWithEmailAndPassword(getAuthClient(), e, password)
}

export async function signOutUser(): Promise<void> {
  await signOut(getAuthClient())
}
