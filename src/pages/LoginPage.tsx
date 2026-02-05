import { useState } from 'react'
import { useAuth } from '../lib/authContext'
import rightImageUrl from '../assets/Logo.jpg'
import './login.css'
import '../components/layout.css'

export function LoginPage() {
  const auth = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  function formatAuthError(err: unknown): string {
    const anyErr = err as { code?: unknown; message?: unknown }
    const code = typeof anyErr?.code === 'string' ? anyErr.code : undefined
    const message = typeof anyErr?.message === 'string' ? anyErr.message : undefined

    if (code === 'auth/configuration-not-found') {
      return 'Firebase Auth ยังไม่ได้เปิดใช้งานในโปรเจกต์นี้: ไปที่ Firebase Console → Authentication → Get started แล้วเปิด Email/Password จากนั้นรีเฟรชหน้าเว็บ'
    }

    return message ?? String(err)
  }

  async function onSignIn() {
    setError(null)
    setLoading(true)
    try {
      await auth.signInWithEmailPassword(email, password)
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="loginRoot">
      <div className="loginLeft">
        <div className="loginLeftInner">
          <section className="loginCard stack">
            <div className="loginHello">
              <div className="loginHelloTitle">Hello!</div>
              <div className="hint">Sign in to your account</div>
            </div>
            {error ? <div className="errorBox">{error}</div> : null}
            <div className="row">
              <div className="loginInputWrap">
                <span className="loginInputIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M4 7.5c0-1.38 1.12-2.5 2.5-2.5h11C19.88 5 21 6.12 21 7.5v9c0 1.38-1.12 2.5-2.5 2.5h-11C5.12 19 4 17.88 4 16.5v-9Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="m6 8 6 4 6-4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="username"
                  placeholder="User หรือ E-mail"
                />
              </div>
            </div>
            <div className="row">
              <div className="loginPasswordRow">
                <span className="loginInputIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M7 10V8a5 5 0 0 1 10 0v2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M6.5 10h11A2.5 2.5 0 0 1 20 12.5v6A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-6A2.5 2.5 0 0 1 6.5 10Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                </span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="loginShowBtn"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
            <div className="actions">
              <button
                type="button"
                className="primaryBtn"
                onClick={() => void onSignIn()}
                disabled={loading || !email.trim() || !password}
              >
                SIGN IN
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="loginRight">
        <img className="loginRightImage" src={rightImageUrl} alt="" />
      </div>
    </div>
  )
}
