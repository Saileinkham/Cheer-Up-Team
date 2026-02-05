import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UserAccess, UserRole } from '../types'
import { deleteUserAccess, listUserAccess, upsertUserAccess } from '../lib/firestore'
import { useAuth } from '../lib/authContext'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
}

export function UsersPage() {
  const auth = useAuth()
  const [list, setList] = useState<UserAccess[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('staff')
  const [primaryAdmin, setPrimaryAdmin] = useState(false)

  const canManageUsers = Boolean(auth.user && auth.isPrimaryAdmin)

  const refresh = useCallback(async () => {
    if (!auth.user) return
    if (!auth.isPrimaryAdmin) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const rows = await listUserAccess()
      setList(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [auth.user, auth.isPrimaryAdmin])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const safeEmail = useMemo(() => email.trim().toLowerCase(), [email])

  async function onSave() {
    if (!canManageUsers) {
      setError('บัญชีนี้ไม่มีสิทธิ์จัดการผู้ใช้')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await upsertUserAccess({ email: safeEmail, role, primaryAdmin })
      setEmail('')
      setRole('staff')
      setPrimaryAdmin(false)
      await refresh()
      setSuccess('บันทึกสิทธิ์ผู้ใช้เรียบร้อย')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(targetEmail: string) {
    if (!canManageUsers) {
      setError('บัญชีนี้ไม่มีสิทธิ์จัดการผู้ใช้')
      return
    }
    const ok = window.confirm(`ต้องการลบสิทธิ์ของ ${targetEmail} ใช่ไหม?`)
    if (!ok) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await deleteUserAccess(targetEmail)
      await refresh()
      setSuccess('ลบสิทธิ์ผู้ใช้เรียบร้อย')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack">
      {error ? <div className="errorBox">{error}</div> : null}
      {success ? <div className="card">{success}</div> : null}

      <section className="card stack">
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>ตั้งค่าผู้ใช้</div>
          <div className="hint">
            ใช้กำหนดสิทธิ์แบบ Role ให้ผู้ใช้ตามอีเมล (อ่านจาก Firebase Auth) โดย Admin หลักเท่านั้นที่จัดการได้
          </div>
        </div>

        <div className="badge" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>
            ผู้ใช้ปัจจุบัน: <strong>{auth.user?.email ?? '-'}</strong>
          </span>
          <span>
            สิทธิ์: <strong>{ROLE_LABEL[auth.role]}</strong>
            {auth.isPrimaryAdmin ? <strong> (Admin หลัก)</strong> : null}
          </span>
        </div>
      </section>

      <section className="card stack">
        <div style={{ fontWeight: 900, fontSize: 16 }}>เพิ่ม/แก้ไขผู้ใช้</div>
        {!canManageUsers ? <div className="hint">ต้องเป็น Admin หลักจึงจะจัดการผู้ใช้ได้</div> : null}

        <div className="grid2">
          <div className="row">
            <label>E-mail ผู้ใช้</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              inputMode="email"
              autoComplete="email"
            />
          </div>
          <div className="row">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="row">
            <label>Admin หลัก</label>
            <label className="badge" style={{ gap: 10, width: 'fit-content' }}>
              <input
                type="checkbox"
                checked={primaryAdmin}
                onChange={(e) => setPrimaryAdmin(e.target.checked)}
                disabled={!canManageUsers || loading}
              />
              <span>{primaryAdmin ? 'ใช่' : 'ไม่ใช่'}</span>
            </label>
            <div className="hint">มีได้ 1 คน แนะนำให้ตั้งเฉพาะเจ้าของระบบ</div>
          </div>
          <div className="actions" style={{ alignItems: 'end' }}>
            <button
              type="button"
              className="primaryBtn"
              onClick={() => void onSave()}
              disabled={!canManageUsers || loading || !safeEmail}
            >
              บันทึก
            </button>
            <button type="button" className="secondaryBtn" onClick={() => void refresh()} disabled={!canManageUsers || loading}>
              รีเฟรช
            </button>
          </div>
        </div>
      </section>

      <section className="card stack">
        <div style={{ fontWeight: 900, fontSize: 16 }}>รายชื่อผู้ใช้ที่ตั้งค่าแล้ว</div>
        {!canManageUsers ? <div className="hint">เฉพาะ Admin หลักเท่านั้นที่ดูรายชื่อทั้งหมดได้</div> : null}

        <table className="table">
          <thead>
            <tr>
              <th>E-mail</th>
              <th style={{ width: 140 }}>Role</th>
              <th style={{ width: 140 }}>Admin หลัก</th>
              <th style={{ width: 160 }} />
            </tr>
          </thead>
          <tbody>
            {!canManageUsers ? (
              <tr>
                <td className="hint" colSpan={4}>
                  ไม่อนุญาตให้เข้าถึง
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td className="hint" colSpan={4}>
                  ยังไม่มีผู้ใช้ที่ตั้งค่าไว้
                </td>
              </tr>
            ) : (
              list.map((u) => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{u.primaryAdmin ? 'ใช่' : '-'}</td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="secondaryBtn"
                        onClick={() => {
                          setEmail(u.email)
                          setRole(u.role)
                          setPrimaryAdmin(Boolean(u.primaryAdmin))
                        }}
                      >
                        แก้ไข
                      </button>
                      <button type="button" className="secondaryBtn" onClick={() => void onDelete(u.email)} disabled={loading}>
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

