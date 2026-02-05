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

type RankedBranchRow = {
  branchId: string
  value: number
}

type RankedItemRow = {
  name: string
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
  const [dashboardView, setDashboardView] = useState<'cards' | 'table'>('cards')
  const [summaryKind, setSummaryKind] = useState<'items' | 'branches'>('items')

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
    return { top }
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
      .map(([id, qty]) => ({ branchId: id, value: qty }))
      .sort((a, b) => b.value - a.value)
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
    return { top }
  }, [employeesInScope, salesInScope])

  const itemQtyRanked = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of salesInScope) {
      for (const it of s.items ?? []) {
        const name = typeof it.name === 'string' ? it.name.trim() : ''
        if (!name) continue
        map.set(name, (map.get(name) ?? 0) + numberOrZero(it.qty))
      }
    }
    const rows: RankedItemRow[] = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
    return rows
  }, [salesInScope])

  const branchQtyRanked = useMemo(() => qtyByBranch.slice(0, 10), [qtyByBranch])

  return (
    <div className="stack">
      {error ? <div className="errorBox">{error}</div> : null}

      <section className="card stack">
        <div className="cardHeader">
          <div>
            <div className="pageTitle">Dashboard</div>
            <div className="hint">สรุป Top/Bottom 5 เชื่อมข้อมูลจากทะเบียนพนักงานและรายการขาย</div>
          </div>
          <div className="actions">
            <div className="segmented" role="tablist" aria-label="รูปแบบรายงาน">
              <button
                type="button"
                className={dashboardView === 'cards' ? 'segmentedBtn active' : 'segmentedBtn'}
                onClick={() => setDashboardView('cards')}
              >
                แบบจัดอันดับ
              </button>
              <button
                type="button"
                className={dashboardView === 'table' ? 'segmentedBtn active' : 'segmentedBtn'}
                onClick={() => setDashboardView('table')}
              >
                แบบตาราง
              </button>
            </div>
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
            <div className="cardTitleLg">Top 5 พนักงานขายเก่ง</div>
            <div className="hint">{cheerItemName ? `รายการ: ${cheerItemName}` : 'ยังไม่ได้เลือกรายการ'}</div>
          </div>
          <div className="rankList">
            {qtyRanked.top.map((r, idx) => (
              <div key={r.employee.id} className="rankItem">
                <div className="rankIndex">{idx + 1}</div>
                <div className="rankMain">
                  {r.employee.photoUrl ? <img className="avatar" src={r.employee.photoUrl} alt="" /> : <span className="avatarPlaceholder" />}
                  <div style={{ minWidth: 0 }}>
                    <div className="rankName">{employeeDisplayName(r.employee)}</div>
                    <div className="rankSub">{branchNameById.get(r.employee.branchId) ?? '-'}</div>
                  </div>
                </div>
                <div className="rankValue">{Math.round(r.value)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <div>
            <div className="cardTitleLg">Top 5 Per Head</div>
            <div className="hint">ต้องบันทึกจำนวนลูกค้าในหน้า “อัปเดตรายการขาย” เพื่อความแม่นยำ</div>
          </div>
          <div className="rankList">
            {perHeadRanked.top.map((r, idx) => (
              <div key={r.employee.id} className="rankItem">
                <div className="rankIndex">{idx + 1}</div>
                <div className="rankMain">
                  {r.employee.photoUrl ? <img className="avatar" src={r.employee.photoUrl} alt="" /> : <span className="avatarPlaceholder" />}
                  <div style={{ minWidth: 0 }}>
                    <div className="rankName">{employeeDisplayName(r.employee)}</div>
                    <div className="rankSub">{branchNameById.get(r.employee.branchId) ?? '-'}</div>
                  </div>
                </div>
                <div className="rankValue">{formatAmount(r.value)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card stack">
        <div className="cardHeader">
          <div>
            <div className="cardTitleLg">สรุปยอดขาย</div>
            <div className="hint">
              {summaryKind === 'branches'
                ? cheerItemName
                  ? `สาขาที่ขายได้ (รายการ: ${cheerItemName})`
                  : 'กรุณาเลือกรายการเชียร์ขาย'
                : 'รายการที่ขายได้ (รวมทุกสินค้าในเดือนที่เลือก)'}
            </div>
          </div>
          <div className="actions">
            <div className="segmented" role="tablist" aria-label="ประเภทสรุป">
              <button
                type="button"
                className={summaryKind === 'items' ? 'segmentedBtn active' : 'segmentedBtn'}
                onClick={() => setSummaryKind('items')}
              >
                รายการขายดี
              </button>
              <button
                type="button"
                className={summaryKind === 'branches' ? 'segmentedBtn active' : 'segmentedBtn'}
                onClick={() => setSummaryKind('branches')}
              >
                สาขาขายดี
              </button>
            </div>
          </div>
        </div>

        {dashboardView === 'cards' ? (
          summaryKind === 'items' ? (
            <div className="rankList">
              {itemQtyRanked.length === 0 ? (
                <div className="hint">ยังไม่มีข้อมูลรายการขายในเดือนที่เลือก</div>
              ) : (
                itemQtyRanked.map((r, idx) => (
                  <div key={r.name} className="rankItem">
                    <div className="rankIndex">{idx + 1}</div>
                    <div className="rankMain">
                      <div style={{ minWidth: 0 }}>
                        <div className="rankName">{r.name}</div>
                        <div className="rankSub">จำนวนรวม</div>
                      </div>
                    </div>
                    <div className="rankValue">{Math.round(r.value)}</div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="rankList">
              {branchQtyRanked.length === 0 ? (
                <div className="hint">ยังไม่มีข้อมูลจำนวนขายของรายการนี้ในเดือนที่เลือก</div>
              ) : (
                branchQtyRanked.map((r: RankedBranchRow, idx) => (
                  <div key={r.branchId} className="rankItem">
                    <div className="rankIndex">{idx + 1}</div>
                    <div className="rankMain">
                      <div style={{ minWidth: 0 }}>
                        <div className="rankName">{branchNameById.get(r.branchId) ?? r.branchId}</div>
                        <div className="rankSub">จำนวนขาย (รายการที่เลือก)</div>
                      </div>
                    </div>
                    <div className="rankValue">{Math.round(r.value)}</div>
                  </div>
                ))
              )}
            </div>
          )
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>อันดับ</th>
                <th>{summaryKind === 'items' ? 'รายการ' : 'สาขา'}</th>
                <th style={{ width: 160 }}>จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {summaryKind === 'items' ? (
                itemQtyRanked.length === 0 ? (
                  <tr>
                    <td className="hint" colSpan={3}>
                      ยังไม่มีข้อมูลรายการขายในเดือนที่เลือก
                    </td>
                  </tr>
                ) : (
                  itemQtyRanked.map((r, idx) => (
                    <tr key={r.name}>
                      <td>{idx + 1}</td>
                      <td>{r.name}</td>
                      <td>{Math.round(r.value)}</td>
                    </tr>
                  ))
                )
              ) : branchQtyRanked.length === 0 ? (
                <tr>
                  <td className="hint" colSpan={3}>
                    ยังไม่มีข้อมูลจำนวนขายของรายการนี้ในเดือนที่เลือก
                  </td>
                </tr>
              ) : (
                branchQtyRanked.map((r, idx) => (
                  <tr key={r.branchId}>
                    <td>{idx + 1}</td>
                    <td>{branchNameById.get(r.branchId) ?? r.branchId}</td>
                    <td>{Math.round(r.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        <div className="hint">หมายเหตุ: คิดจากข้อมูลใน collection sales และผูกชื่อพนักงาน/สาขาจากทะเบียนพนักงาน</div>
      </section>
    </div>
  )
}
