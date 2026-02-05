import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Branch, Employee, Sale, SaleItem } from '../types'
import {
  createSale,
  listBranches,
  listEmployees,
  listSalesByDateRange,
} from '../lib/firestore'
import { employeeDisplayName } from '../lib/employee'
import { currentMonthIso, monthRange, todayIso } from '../lib/dates'
import { formatAmount } from '../lib/format'
import { useAuth } from '../lib/authContext'

type SaleItemDraft = {
  id: string
  name: string
  qty: string
  price: string
}

export function AddSalePage() {
  const auth = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [branchId, setBranchId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [amount, setAmount] = useState('')
  const [saleDateIso, setSaleDateIso] = useState(todayIso())
  const [note, setNote] = useState('')
  const [items, setItems] = useState<SaleItemDraft[]>([
    { id: '1', name: '', qty: '1', price: '' },
  ])

  const [listMonthIso, setListMonthIso] = useState(currentMonthIso())

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>()
    employees.forEach((e) => map.set(e.id, e))
    return map
  }, [employees])

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>()
    branches.forEach((b) => map.set(b.id, b.name))
    return map
  }, [branches])

  const employeesInBranch = useMemo(() => {
    return employees.filter((e) => e.active && e.branchId === branchId)
  }, [employees, branchId])

  const normalizedItems = useMemo((): SaleItem[] | undefined => {
    const output: SaleItem[] = []
    for (const item of items) {
      const name = item.name.trim()
      const qty = Number(item.qty)
      const price = Number(item.price)
      if (!name) continue
      if (!Number.isFinite(qty) || qty <= 0) continue
      if (!Number.isFinite(price) || price < 0) continue
      output.push({ name, qty, price })
    }
    return output.length > 0 ? output : undefined
  }, [items])

  const computedAmount = useMemo(() => {
    return normalizedItems?.reduce((sum, x) => sum + x.qty * x.price, 0) ?? 0
  }, [normalizedItems])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [b, e] = await Promise.all([listBranches(), listEmployees()])
      setBranches(b)
      setEmployees(e)
      const firstBranchId = b[0]?.id ?? ''
      setBranchId((prev) => prev || firstBranchId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshSalesList = useCallback(async () => {
    setError(null)
    try {
      const range = monthRange(listMonthIso)
      const sales = await listSalesByDateRange(range)
      setRecentSales(sales)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [listMonthIso])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    void refreshSalesList()
  }, [refreshSalesList])

  useEffect(() => {
    const available = employeesInBranch
    if (available.length === 0) {
      setEmployeeId('')
      return
    }
    setEmployeeId((prev) => (prev && available.some((x) => x.id === prev) ? prev : available[0]!.id))
  }, [employeesInBranch])

  async function onSubmit() {
    if (!auth.user) {
      setError('กรุณาเข้าสู่ระบบก่อน')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const employee = employeeById.get(employeeId)
      if (!employee) throw new Error('กรุณาเลือกพนักงาน')
      await createSale({
        employeeId: employee.id,
        branchId: employee.branchId,
        amount: normalizedItems ? computedAmount : Number(amount),
        saleDateIso,
        items: normalizedItems,
        note,
      })
      setAmount('')
      setNote('')
      setItems([{ id: String(Date.now()), name: '', qty: '1', price: '' }])
      setSuccess('บันทึกยอดขายเรียบร้อย')
      await refreshSalesList()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function onAddItemRow() {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now() + prev.length), name: '', qty: '1', price: '' },
    ])
  }

  function onRemoveItemRow(id: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)))
  }

  return (
    <div className="stack">
      {error ? <div className="errorBox">{error}</div> : null}
      {success ? <div className="card">{success}</div> : null}

      <section className="card stack">
        <div style={{ fontWeight: 800, fontSize: 16 }}>เพิ่มข้อมูลการขาย</div>

        <div className="grid2">
          <div className="row">
            <label>สาขา</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label>พนักงาน</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employeesInBranch.map((e) => (
                <option key={e.id} value={e.id}>
                  {employeeDisplayName(e)}
                </option>
              ))}
            </select>
            {employeesInBranch.length === 0 ? (
              <div className="hint">ยังไม่มีพนักงานในสาขานี้ (ไปที่ “ตั้งค่า” เพื่อเพิ่มพนักงาน)</div>
            ) : null}
          </div>
          <div className="row">
            <label>วันที่ขาย</label>
            <input type="date" value={saleDateIso} onChange={(e) => setSaleDateIso(e.target.value)} />
          </div>
          <div className="row">
            <label>ยอดขาย</label>
            {normalizedItems ? (
              <input value={String(computedAmount)} disabled />
            ) : (
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="เช่น 25000"
              />
            )}
            <div className="hint">
              ถ้าใส่ “รายการขาย” ระบบจะคำนวณยอดขายรวมให้อัตโนมัติจาก จำนวน x ราคา
            </div>
          </div>
          <div className="row">
            <label>หมายเหตุ</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ไม่บังคับ" />
          </div>
          <div className="actions" style={{ alignItems: 'end' }}>
            <button
              type="button"
              className="primaryBtn"
              onClick={() => void onSubmit()}
              disabled={loading || employeesInBranch.length === 0}
            >
              บันทึกยอดขาย
            </button>
            <button
              type="button"
              className="secondaryBtn"
              onClick={() => void refresh()}
              disabled={loading}
            >
              รีเฟรชสาขา/พนักงาน
            </button>
          </div>
        </div>
      </section>

      <section className="card stack">
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>รายการขาย</div>
          <div className="hint">เพิ่ม/ลบรายการได้ (ชื่อสินค้า/บริการ, จำนวน, ราคา)</div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>รายการ</th>
              <th style={{ width: '18%' }}>จำนวน</th>
              <th style={{ width: '22%' }}>ราคา</th>
              <th style={{ width: '15%' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    value={item.name}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)),
                      )
                    }
                    placeholder="เช่น เคสโทรศัพท์"
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    value={item.qty}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, qty: e.target.value } : x)),
                      )
                    }
                    placeholder="1"
                  />
                </td>
                <td>
                  <input
                    inputMode="decimal"
                    value={item.price}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, price: e.target.value } : x)),
                      )
                    }
                    placeholder="0"
                  />
                </td>
                <td>
                  <div className="actions">
                    <button
                      type="button"
                      className="secondaryBtn"
                      onClick={() => onRemoveItemRow(item.id)}
                      disabled={items.length <= 1}
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="actions">
          <button type="button" className="secondaryBtn" onClick={onAddItemRow}>
            เพิ่มรายการ
          </button>
          {normalizedItems ? (
            <div className="hint">รวม: {formatAmount(computedAmount)}</div>
          ) : (
            <div className="hint">ถ้ายังไม่กรอกชื่อ/จำนวน/ราคา จะไม่ถูกบันทึกเป็นรายการขาย</div>
          )}
        </div>
      </section>

      <section className="card stack">
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>รายการขาย (ดูอย่างเดียว)</div>
          <div className="hint">มองเห็นข้อมูลทุกสาขาจากรายการขาย แต่ไม่สามารถแก้ไขรายการเดิมได้</div>
        </div>

        <div className="grid2">
          <div className="row">
            <label>เลือกเดือน</label>
            <input type="month" value={listMonthIso} onChange={(e) => setListMonthIso(e.target.value)} />
          </div>
          <div className="actions" style={{ alignItems: 'end' }}>
            <button
              type="button"
              className="secondaryBtn"
              onClick={() => void refreshSalesList()}
              disabled={loading}
            >
              รีเฟรชรายการ
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>สาขา</th>
              <th>พนักงาน</th>
              <th>ยอดขาย</th>
              <th>รายการ</th>
            </tr>
          </thead>
          <tbody>
            {recentSales.length === 0 ? (
              <tr>
                <td className="hint" colSpan={5}>
                  ยังไม่มีข้อมูลการขายในเดือนที่เลือก
                </td>
              </tr>
            ) : (
              recentSales.map((s) => {
                const employee = employeeById.get(s.employeeId)
                return (
                  <tr key={s.id}>
                    <td>{s.saleDateIso}</td>
                    <td>{branchNameById.get(s.branchId) ?? '-'}</td>
                    <td>{employee ? employeeDisplayName(employee) : '-'}</td>
                    <td>{formatAmount(s.amount)}</td>
                    <td>{s.items ? `${s.items.length} รายการ` : '-'}</td>
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
