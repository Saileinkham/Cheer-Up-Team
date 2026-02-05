import { initializeApp, type FirebaseApp, getApps } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

type FirebaseBundle = {
  app: FirebaseApp
  db: Firestore
}

let cached: FirebaseBundle | null = null
let cachedError: Error | null = null

function assertEnv(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing env: ${name}`)
  }
  return value
}

export function getFirebase(): FirebaseBundle {
  if (cached) return cached
  if (cachedError) throw cachedError

  try {
    const config = {
      apiKey: assertEnv('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
      authDomain: assertEnv(
        'VITE_FIREBASE_AUTH_DOMAIN',
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      ),
      projectId: assertEnv('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID),
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
      appId: assertEnv('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID),
    }

    const app = getApps().length > 0 ? getApps()[0]! : initializeApp(config)
    const db = getFirestore(app)

    cached = { app, db }
    return cached
  } catch (err) {
    cachedError = err instanceof Error ? err : new Error(String(err))
    throw cachedError
  }
}

