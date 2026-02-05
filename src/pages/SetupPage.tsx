import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Branch, Employee } from '../types'
import {
  createBranch,
  createEmployee,
  deleteSalesForEmployee,
  listBranches,
  listEmployees,
} from '../lib/firestore'
import { employeeDisplayName } from '../lib/employee'
import { useAuth } from '../lib/authContext'

export function SetupPage() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }

  async function onDeleteEmployeeSales(employee: Employee) {
    if (!auth.user) {
      setError('กรุณาเข้าสู่ระบบก่อน')
      return
    }
    if (!auth.isAdmin) {
      setError('บัญชีนี้ไม่มีสิทธิ์ลบข้อมูลการขาย')
      return
    }
    const display = employeeDisplayName(employee)
    const ok = window.confirm(`ต้องการลบข้อมูลการขายทั้งหมดของ ${display} ใช่ไหม?`)
    if (!ok) return

    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const deleted = await deleteSalesForEmployee(employee.id)
      setSuccess(`ลบข้อมูลการขายของ ${display} แล้ว (${deleted} รายการ)`)
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
          <div style={{ fontWeight: 800, fontSize: 16 }}>ตั้งค่าสาขา</div>
          <div className="hint">เพิ่มสาขาก่อน แล้วค่อยเพิ่มพนักงานในสาขานั้น</div>
          {!auth.isManager ? <div className="hint">สิทธิ์ที่ต้องใช้: Manager หรือ Admin</div> : null}
        </div>

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
            <button
              type="button"
              className="secondaryBtn"
              onClick={() => void refresh()}
              disabled={loading}
            >
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
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>ตั้งค่าพนักงาน</div>
          <div className="hint">เก็บ รูป/ชื่อ/นามสกุล/ชื่อเล่น/สาขา เพื่อใช้สรุปยอดขาย</div>
          {!auth.isManager ? <div className="hint">สิทธิ์ที่ต้องใช้: Manager หรือ Admin</div> : null}
        </div>

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
            <label>ชื่อ</label>
            <input
              value={employeeFirstName}
              onChange={(e) => setEmployeeFirstName(e.target.value)}
              placeholder="ชื่อจริง"
            />
          </div>
          <div className="row">
            <label>นามสกุล</label>
            <input
              value={employeeLastName}
              onChange={(e) => setEmployeeLastName(e.target.value)}
              placeholder="นามสกุล"
            />
          </div>
          <div className="row">
            <label>ชื่อเล่น</label>
            <input
              value={employeeNickName}
              onChange={(e) => setEmployeeNickName(e.target.value)}
              placeholder="ชื่อเล่น (ไม่บังคับ)"
            />
          </div>
          <div className="actions" style={{ alignItems: 'end' }}>
            <button
              type="button"
              className="primaryBtn"
              onClick={() => void onAddEmployee()}
              disabled={loading || branches.length === 0 || !auth.user || !auth.isManager}
            >
              เพิ่มพนักงาน
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>พนักงาน</th>
              <th>สาขา</th>
              <th>สถานะ</th>
              <th>การขาย</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td className="hint" colSpan={4}>
                  ยังไม่มีข้อมูลพนักงาน
                </td>
              </tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="badge">
                      {e.photoUrl ? <img className="avatar" src={e.photoUrl} alt="" /> : null}
                      {employeeDisplayName(e)}
                    </span>
                  </td>
                  <td>{branchNameById.get(e.branchId) ?? '-'}</td>
                  <td>{e.active ? 'ใช้งาน' : 'ไม่ใช้งาน'}</td>
                  <td>
                    <button
                      type="button"
                      className="secondaryBtn"
                      disabled={loading || !auth.user || !auth.isAdmin}
                      onClick={() => void onDeleteEmployeeSales(e)}
                    >
                      ลบยอดขาย
                    </button>
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
