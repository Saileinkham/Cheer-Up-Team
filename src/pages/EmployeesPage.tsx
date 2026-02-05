import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Branch, Employee } from '../types'
import { createBranch, createEmployee, listBranches, listEmployees } from '../lib/firestore'
import { employeeDisplayName } from '../lib/employee'
import { useAuth } from '../lib/authContext'
import { uploadEmployeePhoto } from '../lib/storage'

export function EmployeesPage() {
  const auth = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [newBranchName, setNewBranchName] = useState('')

  const [employeeFirstName, setEmployeeFirstName] = useState('')
  const [employeeLastName, setEmployeeLastName] = useState('')
  const [employeeNickName, setEmployeeNickName] = useState('')
  const [employeePhotoUrl, setEmployeePhotoUrl] = useState('')
  const [employeeBranchId, setEmployeeBranchId] = useState('')

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>()
    branches.forEach((b) => map.set(b.id, b.name))
    return map
  }, [branches])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const [b, e] = await Promise.all([listBranches(), listEmployees()])
      setBranches(b)
      setEmployees(e)
      if (!employeeBranchId && b.length > 0) setEmployeeBranchId(b[0]!.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [employeeBranchId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onAddBranch() {
    if (!auth.user) {
      setError('กรุณาเข้าสู่ระบบก่อน')
      return
    }
    if (!auth.isManager) {
      setError('บัญชีนี้ไม่มีสิทธิ์เพิ่มสาขา')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await createBranch(newBranchName)
      setNewBranchName('')
      await refresh()
      setSuccess('เพิ่มสาขาเรียบร้อย')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onAddEmployee() {
    if (!auth.user) {
      setError('กรุณาเข้าสู่ระบบก่อน')
      return
    }
    if (!auth.isManager) {
      setError('บัญชีนี้ไม่มีสิทธิ์เพิ่มพนักงาน')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await createEmployee({
        firstName: employeeFirstName,
        lastName: employeeLastName,
        nickName: employeeNickName,
        photoUrl: employeePhotoUrl,
        branchId: employeeBranchId,
      })
      setEmployeeFirstName('')
      setEmployeeLastName('')
      setEmployeeNickName('')
      setEmployeePhotoUrl('')
      await refresh()
      setSuccess('เพิ่มพนักงานเรียบร้อย')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onUploadPhoto(file: File) {
    if (!auth.user) {
      setError('กรุณาเข้าสู่ระบบก่อน')
      return
    }
    if (!auth.isManager) {
      setError('บัญชีนี้ไม่มีสิทธิ์อัปโหลดรูปพนักงาน')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const url = await uploadEmployeePhoto(file)
      setEmployeePhotoUrl(url)
      setSuccess('อัปโหลดรูปเรียบร้อย (ระบบใส่ลิงก์ให้แล้ว)')
    } catch (err) {
      const anyErr = err as { code?: unknown; message?: unknown }
      const code = typeof anyErr?.code === 'string' ? anyErr.code : ''
      if (code === 'storage/unauthorized') {
        setError('อัปโหลดไม่สำเร็จ: Storage rules ไม่อนุญาต หรือยังไม่ได้เปิด Firebase Storage')
      } else if (code === 'storage/object-not-found') {
        setError('อัปโหลดไม่สำเร็จ: ไม่พบปลายทาง Storage')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack">
      {error ? <div className="errorBox">{error}</div> : null}
      {success ? <div className="card">{success}</div> : null}

      <section className="card stack">
        <div className="cardTitleLg">สาขา</div>
        <div className="hint">ใช้สำหรับกรองรายงาน และผูกกับทะเบียนพนักงาน</div>

        <div className="grid2">
          <div className="row">
            <label>ชื่อสาขา</label>
            <input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="เช่น สาขากรุงเทพ"
            />
          </div>
          <div className="actions" style={{ alignItems: 'end' }}>
            <button
              type="button"
              className="primaryBtn"
              onClick={() => void onAddBranch()}
              disabled={loading || !auth.user || !auth.isManager}
            >
              เพิ่มสาขา
            </button>
            <button type="button" className="secondaryBtn" onClick={() => void refresh()} disabled={loading}>
              รีเฟรช
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>สาขา</th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 ? (
              <tr>
                <td className="hint">ยังไม่มีข้อมูลสาขา</td>
              </tr>
            ) : (
              branches.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <div className="cardTitleLg">เพิ่มพนักงาน</div>
        {!auth.isManager ? <div className="hint">สิทธิ์ที่ต้องใช้: Manager หรือ Admin</div> : null}

        <div className="grid2">
          <div className="row">
            <label>สาขา</label>
            <select value={employeeBranchId} onChange={(e) => setEmployeeBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label>ลิงก์รูป (URL)</label>
            <input
              value={employeePhotoUrl}
              onChange={(e) => setEmployeePhotoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="row">
            <label>อัปโหลดรูป</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onUploadPhoto(file)
              }}
              disabled={loading || !auth.user || !auth.isManager}
            />
            <div className="hint">อัปโหลดแล้วระบบจะเติมลิงก์รูปให้อัตโนมัติ</div>
          </div>
          <div className="row">
            <label>ชื่อ</label>
            <input value={employeeFirstName} onChange={(e) => setEmployeeFirstName(e.target.value)} />
          </div>
          <div className="row">
            <label>นามสกุล</label>
            <input value={employeeLastName} onChange={(e) => setEmployeeLastName(e.target.value)} />
          </div>
          <div className="row">
            <label>ชื่อเล่น</label>
            <input value={employeeNickName} onChange={(e) => setEmployeeNickName(e.target.value)} />
          </div>
          <div className="actions" style={{ alignItems: 'end' }}>
            <button
              type="button"
              className="primaryBtn"
              onClick={() => void onAddEmployee()}
              disabled={loading || !auth.user || !auth.isManager}
            >
              เพิ่มพนักงาน
            </button>
          </div>
        </div>

        {employeePhotoUrl.trim() ? (
          <div className="badge">
            <img className="avatar" src={employeePhotoUrl.trim()} alt="" />
            <span className="hint">ตัวอย่างรูปพนักงาน</span>
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <div className="cardTitleLg">รายชื่อพนักงาน</div>
        <div className="hint">ข้อมูลหน้านี้ถูกใช้ร่วมกับหน้ารายการขายและ Dashboard</div>

        <table className="table">
          <thead>
            <tr>
              <th>พนักงาน</th>
              <th>สาขา</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td className="hint" colSpan={3}>
                  ยังไม่มีข้อมูลพนักงาน
                </td>
              </tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="badge">
                      {e.photoUrl ? <img className="avatar" src={e.photoUrl} alt="" /> : <span className="hint">ไม่มีรูป</span>}
                      <span>{employeeDisplayName(e)}</span>
                    </div>
                  </td>
                  <td>{branchNameById.get(e.branchId) ?? '-'}</td>
                  <td>{e.active ? 'ใช้งาน' : 'ปิดใช้งาน'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
