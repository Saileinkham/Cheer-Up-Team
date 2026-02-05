import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Branch, CheerItem, Employee, Sale } from '../types'
import { listBranches, listCheerItems, listEmployees, listSalesByDateRange } from '../lib/firestore'
import { currentMonthIso, monthRange } from '../lib/dates'
import { employeeDisplayName } from '../lib/employee'
import { formatAmount } from '../lib/format'
import { useAuth } from '../lib/authContext'

type RankedRow = {
  employee: Employee
  value: number
}

function numberOrZero(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function NewDashboardPage() {
  const auth = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cheerItems, setCheerItems] = useState<CheerItem[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  const [monthIso, setMonthIso] = useState(currentMonthIso())
  const [branchId, setBranchId] = useState('')
  const [cheerItemId, setCheerItemId] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeCheerItems = useMemo(() => cheerItems.filter((c) => c.active), [cheerItems])

  const cheerItemName = useMemo(() => {
    const found = activeCheerItems.find((c) => c.id === cheerItemId)
    return found?.name ?? ''
  }, [activeCheerItems, cheerItemId])

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>()
    branches.forEach((b) => map.set(b.id, b.name))
    return map
  }, [branches])

  const employeesInScope = useMemo(() => {
    const base = employees.filter((e) => e.active)
    if (!branchId) return base
    return base.filter((e) => e.branchId === branchId)
  }, [employees, branchId])

  const refreshMaster = useCallback(async () => {
    if (!auth.user) return
    setLoading(true)
    setError(null)
    try {
      const [b, e, c] = await Promise.all([listBranches(), listEmployees(), listCheerItems()])
      setBranches(b)
      setEmployees(e)
      setCheerItems(c)
      const firstCheer = c.find((x) => x.active)?.id
      if (!cheerItemId && firstCheer) setCheerItemId(firstCheer)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [auth.user, cheerItemId])

  const refreshSales = useCallback(async () => {
    if (!auth.user) return
    setLoading(true)
    setError(null)
    try {
      const list = await listSalesByDateRange(monthRange(monthIso))
      setSales(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [auth.user, monthIso])

  useEffect(() => {
    void refreshMaster()
  }, [refreshMaster])

  useEffect(() => {
    void refreshSales()
  }, [refreshSales])

  const salesInScope = useMemo(() => {
    if (!branchId) return sales
    return sales.filter((s) => s.branchId === branchId)
  }, [sales, branchId])

  const qtyByEmployee = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of employeesInScope) map.set(e.id, 0)
    if (!cheerItemName) return map
    for (const s of salesInScope) {
      if (!map.has(s.employeeId)) continue
      const qty = (s.items ?? [])
        .filter((it) => it.name === cheerItemName)
        .reduce((sum, it) => sum + numberOrZero(it.qty), 0)
      map.set(s.employeeId, (map.get(s.employeeId) ?? 0) + qty)
    }
    return map
  }, [employeesInScope, salesInScope, cheerItemName])

  const qtyRanked = useMemo(() => {
    const rows: RankedRow[] = employeesInScope.map((e) => ({ employee: e, value: qtyByEmployee.get(e.id) ?? 0 }))
    const top = [...rows].sort((a, b) => b.value - a.value).slice(0, 5)
    const bottom = [...rows].sort((a, b) => a.value - b.value).slice(0, 5)
    return { top, bottom }
  }, [employeesInScope, qtyByEmployee])

  const qtyByBranch = useMemo(() => {
    const map = new Map<string, number>()
    if (!cheerItemName) return []
    for (const s of sales) {
      const qty = (s.items ?? [])
        .filter((it) => it.name === cheerItemName)
        .reduce((sum, it) => sum + numberOrZero(it.qty), 0)
      map.set(s.branchId, (map.get(s.branchId) ?? 0) + qty)
    }
    return Array.from(map.entries())
      .map(([id, qty]) => ({ branchId: id, qty }))
      .sort((a, b) => b.qty - a.qty)
  }, [sales, cheerItemName])

  const perHeadRanked = useMemo(() => {
    const totalAmountByEmployee = new Map<string, number>()
    const totalCustomersByEmployee = new Map<string, number>()
    for (const e of employeesInScope) {
      totalAmountByEmployee.set(e.id, 0)
      totalCustomersByEmployee.set(e.id, 0)
    }
    for (const s of salesInScope) {
      if (!totalAmountByEmployee.has(s.employeeId)) continue
      totalAmountByEmployee.set(s.employeeId, (totalAmountByEmployee.get(s.employeeId) ?? 0) + numberOrZero(s.amount))
      totalCustomersByEmployee.set(
        s.employeeId,
        (totalCustomersByEmployee.get(s.employeeId) ?? 0) + numberOrZero(s.customers ?? 0),
      )
    }
    const rows: RankedRow[] = employeesInScope.map((e) => {
      const amount = totalAmountByEmployee.get(e.id) ?? 0
      const cust = totalCustomersByEmployee.get(e.id) ?? 0
      const value = cust > 0 ? amount / cust : 0
      return { employee: e, value }
    })
    const top = [...rows].sort((a, b) => b.value - a.value).slice(0, 5)
    const bottom = [...rows].sort((a, b) => a.value - b.value).slice(0, 5)
    return { top, bottom }
  }, [employeesInScope, salesInScope])

  return (
    <div className="stack">
      {error ? <div className="errorBox">{error}</div> : null}

      <section className="card stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Dashboard</div>
            <div className="hint">สรุป Top/Bottom 5 เชื่อมข้อมูลจากทะเบียนพนักงานและรายการขาย</div>
          </div>
          <div className="actions">
            <button type="button" className="secondaryBtn" onClick={() => void refreshSales()} disabled={loading}>
              รีเฟรช
            </button>
          </div>
        </div>

        <div className="grid2">
          <div className="row">
            <label>เดือน</label>
            <input type="month" value={monthIso} onChange={(e) => setMonthIso(e.target.value)} />
          </div>
          <div className="row">
            <label>สาขา (ตัวกรอง)</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label>รายการเชียร์ขาย (ตัวกรอง)</label>
            <select value={cheerItemId} onChange={(e) => setCheerItemId(e.target.value)}>
              {activeCheerItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!cheerItemId ? <div className="hint">ไปเพิ่มรายการได้ที่เมนู “รายการเชียร์ขาย”</div> : null}
          </div>
        </div>
      </section>

      <div className="grid2">
        <section className="card stack">
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Top 5 พนักงาน (จำนวนขาย)</div>
            <div className="hint">{cheerItemName ? `รายการ: ${cheerItemName}` : 'ยังไม่ได้เลือกรายการ'}</div>
          </div>
          <div className="stack">
            {qtyRanked.top.map((r) => (
              <div key={r.employee.id} className="badge" style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {r.employee.photoUrl ? <img className="avatar" src={r.employee.photoUrl} alt="" /> : null}
                  <span>{employeeDisplayName(r.employee)}</span>
                </span>
                <strong>{Math.round(r.value)}</strong>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Bottom 5 พนักงาน (จำนวนขายต่ำ)</div>
          </div>
          <div className="stack">
            {qtyRanked.bottom.map((r) => (
              <div key={r.employee.id} className="badge" style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {r.employee.photoUrl ? <img className="avatar" src={r.employee.photoUrl} alt="" /> : null}
                  <span>{employeeDisplayName(r.employee)}</span>
                </span>
                <strong>{Math.round(r.value)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Top 5 Per Head (ยอดขาย/ลูกค้า)</div>
            <div className="hint">ต้องบันทึกจำนวนลูกค้าในหน้า “อัปเดตรายการขาย” เพื่อความแม่นยำ</div>
          </div>
          <div className="stack">
            {perHeadRanked.top.map((r) => (
              <div key={r.employee.id} className="badge" style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {r.employee.photoUrl ? <img className="avatar" src={r.employee.photoUrl} alt="" /> : null}
                  <span>{employeeDisplayName(r.employee)}</span>
                </span>
                <strong>{formatAmount(r.value)}</strong>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Bottom 5 Per Head</div>
          </div>
          <div className="stack">
            {perHeadRanked.bottom.map((r) => (
              <div key={r.employee.id} className="badge" style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {r.employee.photoUrl ? <img className="avatar" src={r.employee.photoUrl} alt="" /> : null}
                  <span>{employeeDisplayName(r.employee)}</span>
                </span>
                <strong>{formatAmount(r.value)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card stack">
        <div style={{ fontWeight: 900, fontSize: 16 }}>จำนวนขายดี by สาขา</div>
        <div className="hint">{cheerItemName ? `รายการ: ${cheerItemName}` : 'ยังไม่ได้เลือกรายการ'}</div>
        <table className="table">
          <thead>
            <tr>
              <th>สาขา</th>
              <th style={{ width: 160 }}>จำนวน</th>
            </tr>
          </thead>
          <tbody>
            {qtyByBranch.length === 0 ? (
              <tr>
                <td className="hint" colSpan={2}>
                  ยังไม่มีข้อมูลจำนวนขายของรายการนี้ในเดือนที่เลือก
                </td>
              </tr>
            ) : (
              qtyByBranch.map((r) => (
                <tr key={r.branchId}>
                  <td>{branchNameById.get(r.branchId) ?? r.branchId}</td>
                  <td>{Math.round(r.qty)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="hint">
          หมายเหตุ: Dashboard คิดจากข้อมูลใน collection <b>sales</b> และผูกชื่อพนักงาน/สาขาจากทะเบียนพนักงาน
        </div>
      </section>
    </div>
  )
}
