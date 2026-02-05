import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CheerItem } from '../types'
import { createCheerItem, deleteCheerItem, listCheerItems, updateCheerItem } from '../lib/firestore'
import { useAuth } from '../lib/authContext'

export function CheerItemsPage() {
  const auth = useAuth()
  const [items, setItems] = useState<CheerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')

  const [draftById, setDraftById] = useState<Record<string, { name: string; price: string; active: boolean }>>(
    {},
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const list = await listCheerItems()
      setItems(list)
      const next: Record<string, { name: string; price: string; active: boolean }> = {}
      for (const it of list) next[it.id] = { name: it.name, price: String(it.price), active: it.active }
      setDraftById(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const canManage = Boolean(auth.user && auth.isManager)
  const canDelete = Boolean(auth.user && auth.isAdmin)

  const activeCount = useMemo(() => items.filter((x) => x.active).length, [items])

  async function onAdd() {
    if (!canManage) {
      setError('บัญชีนี้ไม่มีสิทธิ์เพิ่มรายการเชียร์ขาย')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await createCheerItem({ name: newName, price: Number(newPrice), active: true })
      setNewName('')
      setNewPrice('')
      await refresh()
      setSuccess('เพิ่มรายการเรียบร้อย')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onSave(id: string) {
    if (!canManage) {
      setError('บัญชีนี้ไม่มีสิทธิ์แก้ไขรายการเชียร์ขาย')
      return
    }
    const d = draftById[id]
    if (!d) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await updateCheerItem(id, { name: d.name, price: Number(d.price), active: d.active })
      await refresh()
      setSuccess('บันทึกเรียบร้อย')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(id: string) {
    if (!canDelete) {
      setError('บัญชีนี้ไม่มีสิทธิ์ลบรายการเชียร์ขาย')
      return
    }
    const ok = window.confirm('ต้องการลบรายการนี้ใช่ไหม?')
    if (!ok) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await deleteCheerItem(id)
      await refresh()
      setSuccess('ลบรายการเรียบร้อย')
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
          <div style={{ fontWeight: 900, fontSize: 16 }}>รายการเชียร์ขาย</div>
          <div className="hint">
            ใช้เป็นรายการให้เลือกตอนอัปเดตรายการขาย ({activeCount}/{items.length} รายการที่เปิดใช้งาน)
          </div>
          {!canManage ? <div className="hint">สิทธิ์ที่ต้องใช้: Manager หรือ Admin</div> : null}
        </div>

        <div className="grid2">
          <div className="row">
            <label>ชื่อรายการ</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น น้ำผัก" />
          </div>
          <div className="row">
            <label>ราคา</label>
            <input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
          </div>
          <div className="actions" style={{ alignItems: 'end' }}>
            <button type="button" className="primaryBtn" onClick={() => void onAdd()} disabled={loading || !canManage}>
              เพิ่มรายการ
            </button>
            <button type="button" className="secondaryBtn" onClick={() => void refresh()} disabled={loading}>
              รีเฟรช
            </button>
          </div>
        </div>
      </section>

      <section className="card stack">
        <div style={{ fontWeight: 900, fontSize: 16 }}>รายการทั้งหมด</div>

        <table className="table">
          <thead>
            <tr>
              <th>ชื่อรายการ</th>
              <th style={{ width: 140 }}>ราคา</th>
              <th style={{ width: 120 }}>ใช้งาน</th>
              <th style={{ width: 220 }} />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="hint" colSpan={4}>
                  ยังไม่มีรายการเชียร์ขาย
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const d = draftById[it.id] ?? { name: it.name, price: String(it.price), active: it.active }
                return (
                  <tr key={it.id}>
                    <td>
                      <input
                        value={d.name}
                        onChange={(e) =>
                          setDraftById((prev) => ({ ...prev, [it.id]: { ...d, name: e.target.value } }))
                        }
                        disabled={!canManage || loading}
                      />
                    </td>
                    <td>
                      <input
                        value={d.price}
                        onChange={(e) =>
                          setDraftById((prev) => ({ ...prev, [it.id]: { ...d, price: e.target.value } }))
                        }
                        inputMode="decimal"
                        disabled={!canManage || loading}
                      />
                    </td>
                    <td>
                      <label className="badge" style={{ gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={d.active}
                          onChange={(e) =>
                            setDraftById((prev) => ({ ...prev, [it.id]: { ...d, active: e.target.checked } }))
                          }
                          disabled={!canManage || loading}
                        />
                        <span>{d.active ? 'เปิด' : 'ปิด'}</span>
                      </label>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="primaryBtn"
                          onClick={() => void onSave(it.id)}
                          disabled={!canManage || loading}
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          className="secondaryBtn"
                          onClick={() => void onDelete(it.id)}
                          disabled={!canDelete || loading}
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
