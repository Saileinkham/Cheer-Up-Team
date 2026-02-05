import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Branch, CheerItem, Employee, SaleItem } from '../types'
import { createSale, listBranches, listCheerItems, listEmployees, listSalesByDateRange } from '../lib/firestore'
import { todayIso, monthRange } from '../lib/dates'
import { employeeDisplayName } from '../lib/employee'
import { formatAmount } from '../lib/format'
import { useAuth } from '../lib/authContext'

type DraftRow = {
  id: string
  cheerItemId: string
  customName: string
  qty: string
  price: string
}

export function SalesUpdatePage() {
  const auth = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cheerItems, setCheerItems] = useState<CheerItem[]>([])

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [saleDate, setSaleDate] = useState(todayIso())
  const [customers, setCustomers] = useState('')

  const [rows, setRows] = useState<DraftRow[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [monthIso, setMonthIso] = useState(() => saleDate.slice(0, 7))
  const [recentSales, setRecentSales] = useState<
    { id: string; employeeName: string; branchName: string; amount: number; saleDateIso: string }[]
  >([])

  const activeCheerItems = useMemo(() => cheerItems.filter((c) => c.active), [cheerItems])

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>()
    branches.forEach((b) => map.set(b.id, b.name))
    return map
  }, [branches])

  const employeesForBranch = useMemo(() => {
    if (!selectedBranchId) return employees
    return employees.filter((e) => e.branchId === selectedBranchId)
  }, [employees, selectedBranchId])

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>()
    employees.forEach((e) => map.set(e.id, e))
    return map
  }, [employees])

  const refreshMaster = useCallback(async () => {
    if (!auth.user) return
    setLoading(true)
    setError(null)
    try {
      const [b, e, c] = await Promise.all([listBranches(), listEmployees(), listCheerItems()])
      setBranches(b)
      setEmployees(e)
      setCheerItems(c)
      if (!selectedBranchId && b.length > 0) setSelectedBranchId(b[0]!.id)
      if (!selectedEmployeeId && e.length > 0) setSelectedEmployeeId(e[0]!.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [auth.user, selectedBranchId, selectedEmployeeId])

  const refreshRecent = useCallback(async () => {
    if (!auth.user) return
    setLoading(true)
    setError(null)
    try {
      const range = monthRange(monthIso)
      const list = await listSalesByDateRange(range)
      const mapped = list.slice(0, 20).map((s) => {
        const emp = employeeById.get(s.employeeId)
        const br = branchNameById.get(s.branchId)
        return {
          id: s.id,
          employeeName: emp ? employeeDisplayName(emp) : s.employeeId,
          branchName: br ?? s.branchId,
          amount: s.amount,
          saleDateIso: s.saleDateIso,
        }
      })
      setRecentSales(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setRecentSales([])
    } finally {
      setLoading(false)
    }
  }, [auth.user, monthIso, employeeById, branchNameById])

  useEffect(() => {
    void refreshMaster()
  }, [refreshMaster])

  useEffect(() => {
    void refreshRecent()
  }, [refreshRecent])

  useEffect(() => {
    setMonthIso(saleDate.slice(0, 7))
  }, [saleDate])

  useEffect(() => {
    if (!selectedBranchId) return
    if (!selectedEmployeeId) {
      const first = employeesForBranch[0]?.id
      if (first) setSelectedEmployeeId(first)
      return
    }
    const current = employeeById.get(selectedEmployeeId)
    if (current && current.branchId === selectedBranchId) return
    const first = employeesForBranch[0]?.id
    if (first) setSelectedEmployeeId(first)
  }, [selectedBranchId, selectedEmployeeId, employeesForBranch, employeeById])

  useEffect(() => {
    if (rows.length === 0) {
      setRows([
        {
          id: 'row-1',
          cheerItemId: '',
          customName: '',
          qty: '',
          price: '',
        },
      ])
    }
  }, [rows.length])

  function onChangeRow(id: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function onAddRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${prev.length + 1}`,
        cheerItemId: '',
        customName: '',
        qty: '',
        price: '',
      },
    ])
  }

  function onRemoveRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }

  const computedItems: SaleItem[] = useMemo(() => {
    const result: SaleItem[] = []
    for (const r of rows) {
      const cheer = r.cheerItemId ? activeCheerItems.find((c) => c.id === r.cheerItemId) : undefined
      const name = (r.customName || cheer?.name || '').trim()
      const qty = Number(r.qty)
      const price = Number(r.price || (cheer?.price ?? 0))
      if (!name) continue
      if (!Number.isFinite(qty) || qty <= 0) continue
      if (!Number.isFinite(price) || price < 0) continue
      result.push({ name, qty, price })
    }
    return result
  }, [rows, activeCheerItems])

  const computedTotal = useMemo(
    () => computedItems.reduce((sum, x) => sum + x.qty * x.price, 0),
    [computedItems],
  )

  const canSubmit = useMemo(() => {
    return Boolean(
      auth.user &&
        selectedBranchId &&
        selectedEmployeeId &&
        saleDate &&
        computedItems.length > 0 &&
        computedTotal > 0,
    )
  }, [auth.user, selectedBranchId, selectedEmployeeId, saleDate, computedItems.length, computedTotal])

  async function onSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await createSale({
        employeeId: selectedEmployeeId,
        branchId: selectedBranchId,
        amount: computedTotal,
        customers: customers ? Number(customers) : undefined,
        saleDateIso: saleDate,
        items: computedItems,
      })
      setSuccess('บันทึกยอดขายเรียบร้อย')
      setRows([])
      setCustomers('')
      await refreshRecent()
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
        <div className="pageTitle">อัปเดตรายการขาย</div>
        <div className="grid2">
          <div className="row">
            <label>สาขา</label>
            <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label>พนักงาน</label>
            <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
              {employeesForBranch.map((e) => (
                <option key={e.id} value={e.id}>
                  {employeeDisplayName(e)}
                </option>
              ))}
            </select>
            {employeesForBranch.length === 0 ? <div className="hint">ยังไม่มีพนักงานในสาขานี้</div> : null}
          </div>
          <div className="row">
            <label>วันที่ขาย</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </div>
          <div className="row">
            <label>จำนวนลูกค้าในวันนั้น</label>
            <input
              value={customers}
              onChange={(e) => setCustomers(e.target.value)}
              inputMode="numeric"
              placeholder="เช่น 25"
            />
          </div>
        </div>
      </section>

      <section className="card stack">
        <div className="cardTitleLg">รายการเชียร์ขายในบิล</div>
        <div className="hint">
          เลือกรายการจากรายการเชียร์ขาย หรือพิมพ์ชื่อเองก็ได้ ใส่จำนวนและราคา จากนั้นกดบันทึกด้านล่าง
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>รายการเชียร์ขาย</th>
              <th>หรือพิมพ์ชื่อเอง</th>
              <th style={{ width: 120 }}>จำนวน</th>
              <th style={{ width: 140 }}>ราคา/หน่วย</th>
              <th style={{ width: 140 }}>รวม</th>
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cheer = r.cheerItemId ? activeCheerItems.find((c) => c.id === r.cheerItemId) : undefined
              const qty = Number(r.qty)
              const price = Number(r.price || (cheer?.price ?? 0))
              const lineTotal =
                Number.isFinite(qty) && qty > 0 && Number.isFinite(price) && price >= 0 ? qty * price : 0
              return (
                <tr key={r.id}>
                  <td>
                    <select
                      value={r.cheerItemId}
                      onChange={(e) => onChangeRow(r.id, { cheerItemId: e.target.value })}
                    >
                      <option value="">-- เลือกรายการ --</option>
                      {activeCheerItems.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({formatAmount(c.price)})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={r.customName}
                      onChange={(e) => onChangeRow(r.id, { customName: e.target.value })}
                      placeholder={cheer?.name ?? ''}
                    />
                  </td>
                  <td>
                    <input
                      value={r.qty}
                      onChange={(e) => onChangeRow(r.id, { qty: e.target.value })}
                      inputMode="numeric"
                    />
                  </td>
                  <td>
                    <input
                      value={r.price}
                      onChange={(e) => onChangeRow(r.id, { price: e.target.value })}
                      inputMode="decimal"
                      placeholder={cheer ? String(cheer.price) : '0'}
                    />
                  </td>
                  <td>{lineTotal > 0 ? formatAmount(lineTotal) : '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="secondaryBtn"
                      onClick={() => onRemoveRow(r.id)}
                      disabled={rows.length <= 1}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="secondaryBtn" onClick={onAddRow}>
            เพิ่มแถว +
          </button>
          <div className="badge">
            <span>รวมทั้งบิล</span>
            <strong>{formatAmount(computedTotal)}</strong>
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="primaryBtn"
            onClick={() => void onSubmit()}
            disabled={!canSubmit || loading}
          >
            บันทึกยอดขาย
          </button>
        </div>
      </section>

      <section className="card stack">
        <div className="cardTitleLg">ยอดขายล่าสุดในเดือนนี้</div>

        <table className="table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>พนักงาน</th>
              <th>สาขา</th>
              <th style={{ width: 160 }}>ยอดขาย</th>
            </tr>
          </thead>
          <tbody>
            {recentSales.length === 0 ? (
              <tr>
                <td className="hint" colSpan={4}>
                  ยังไม่มีข้อมูลยอดขายในเดือนนี้
                </td>
              </tr>
            ) : (
              recentSales.map((s) => (
                <tr key={s.id}>
                  <td>{s.saleDateIso}</td>
                  <td>{s.employeeName}</td>
                  <td>{s.branchName}</td>
                  <td>{formatAmount(s.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
