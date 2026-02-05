import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Branch, Employee, Sale } from '../types'
import { listBranches, listEmployees, listSalesByDateRange } from '../lib/firestore'
import { currentMonthIso, monthRange, yearRange } from '../lib/dates'
import { employeeDisplayName } from '../lib/employee'
import { formatAmount } from '../lib/format'
import { useAuth } from '../lib/authContext'

const CHART_COLORS = [
  'rgba(123, 97, 255, 0.95)',
  'rgba(106, 255, 163, 0.95)',
  'rgba(255, 193, 99, 0.95)',
  'rgba(99, 220, 255, 0.95)',
  'rgba(255, 120, 120, 0.95)',
] as const

function monthKeyFrom(yearKey: string, monthIndex: number): string {
  const m = String(monthIndex + 1).padStart(2, '0')
  return `${yearKey}-${m}`
}

function sparklinePoints(values: number[], width: number, height: number, padding = 6): string {
  if (values.length === 0) return ''
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const innerW = Math.max(1, width - padding * 2)
  const innerH = Math.max(1, height - padding * 2)
  return values
    .map((v, i) => {
      const x = padding + (innerW * i) / Math.max(1, values.length - 1)
      const t = (v - min) / span
      const y = padding + innerH * (1 - t)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function sparklinePointsDomain(
  values: number[],
  width: number,
  height: number,
  domainMin: number,
  domainMax: number,
  padding = 6,
): string {
  if (values.length === 0) return ''
  const min = Number.isFinite(domainMin) ? domainMin : 0
  const max = Number.isFinite(domainMax) ? domainMax : 0
  const span = max - min || 1
  const innerW = Math.max(1, width - padding * 2)
  const innerH = Math.max(1, height - padding * 2)
  return values
    .map((v, i) => {
      const x = padding + (innerW * i) / Math.max(1, values.length - 1)
      const t = (v - min) / span
      const y = padding + innerH * (1 - t)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

function safeFileName(value: string): string {
  return value
    .trim()
    .replaceAll(/[\s/\\]+/g, '_')
    .replaceAll(/[^a-zA-Z0-9._-]+/g, '')
}

export function DashboardPage() {
  const auth = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [yearSales, setYearSales] = useState<Sale[]>([])
  const [monthIso, setMonthIso] = useState(currentMonthIso())
  const [employeeIdForGrowth, setEmployeeIdForGrowth] = useState('')
  const [compareEmployeeIds, setCompareEmployeeIds] = useState<string[]>([])
  const [detailMonthKey, setDetailMonthKey] = useState('')
  const [exportFormat, setExportFormat] = useState<'singleItem' | 'billSummary' | 'itemRows'>(
    'singleItem',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const yearKey = useMemo(() => monthIso.split('-')[0] ?? String(new Date().getFullYear()), [monthIso])

  const refreshMasterData = useCallback(async () => {
    if (!auth.user) return
    setLoading(true)
    setError(null)
    try {
      const [b, e] = await Promise.all([listBranches(), listEmployees()])
      setBranches(b)
      setEmployees(e)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [auth.user])

  const refreshSales = useCallback(async () => {
    if (!auth.user) return
    setLoading(true)
    setError(null)
    try {
      const [monthResult, yearResult] = await Promise.all([
        listSalesByDateRange(monthRange(monthIso)),
        listSalesByDateRange(yearRange(yearKey)),
      ])
      setSales(monthResult)
      setYearSales(yearResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSales([])
      setYearSales([])
    } finally {
      setLoading(false)
    }
  }, [auth.user, monthIso, yearKey])

  useEffect(() => {
    void refreshMasterData()
  }, [refreshMasterData])

  useEffect(() => {
    void refreshSales()
  }, [refreshSales])

  useEffect(() => {
    if (employeeIdForGrowth) return
    const firstActive = employees.find((e) => e.active)?.id
    if (firstActive) setEmployeeIdForGrowth(firstActive)
  }, [employees, employeeIdForGrowth])

  useEffect(() => {
    if (detailMonthKey) return
    const m = monthIso
    if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) setDetailMonthKey(m)
  }, [detailMonthKey, monthIso])

  useEffect(() => {
    if (compareEmployeeIds.length > 0) return
    const initial = employees
      .filter((e) => e.active)
      .slice(0, 5)
      .map((e) => e.id)
    if (initial.length > 0) setCompareEmployeeIds(initial)
  }, [employees, compareEmployeeIds.length])

  const mtdTotalAmount = useMemo(() => sales.reduce((sum, s) => sum + s.amount, 0), [sales])
  const ytdTotalAmount = useMemo(
    () => yearSales.reduce((sum, s) => sum + s.amount, 0),
    [yearSales],
  )

  const totalByBranch = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      map.set(s.branchId, (map.get(s.branchId) ?? 0) + s.amount)
    }
    return Array.from(map.entries())
      .map(([branchId, total]) => ({ branchId, total }))
      .sort((a, b) => b.total - a.total)
  }, [sales])

  const totalByBranchYear = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of yearSales) {
      map.set(s.branchId, (map.get(s.branchId) ?? 0) + s.amount)
    }
    return Array.from(map.entries())
      .map(([branchId, total]) => ({ branchId, total }))
      .sort((a, b) => b.total - a.total)
  }, [yearSales])

  const topEmployees = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      map.set(s.employeeId, (map.get(s.employeeId) ?? 0) + s.amount)
    }
    return Array.from(map.entries())
      .map(([employeeId, total]) => ({ employeeId, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [sales])

  const topEmployeesYear = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of yearSales) {
      map.set(s.employeeId, (map.get(s.employeeId) ?? 0) + s.amount)
    }
    return Array.from(map.entries())
      .map(([employeeId, total]) => ({ employeeId, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [yearSales])

  const employeeGrowth = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => monthKeyFrom(yearKey, i))
    const byMonth = new Map<string, Sale[]>()
    for (const m of months) byMonth.set(m, [])
    for (const s of yearSales) {
      if (s.employeeId !== employeeIdForGrowth) continue
      const list = byMonth.get(s.monthKey)
      if (list) list.push(s)
    }

    const rows = months.map((m) => {
      const list = byMonth.get(m) ?? []
      const totalAmount = list.reduce((sum, x) => sum + x.amount, 0)
      const billCount = list.length
      const itemLines = list.reduce((sum, x) => sum + (x.items?.length ?? 0), 0)
      const itemQty = list.reduce(
        (sum, x) => sum + (x.items?.reduce((s2, it) => s2 + it.qty, 0) ?? 0),
        0,
      )
      return { monthKey: m, totalAmount, billCount, itemLines, itemQty }
    })

    const totals = rows.map((r) => r.totalAmount)
    const itemQtys = rows.map((r) => r.itemQty)

    const growthPct = rows.map((r, idx) => {
      if (idx === 0) return null
      const prev = rows[idx - 1]!.totalAmount
      if (!Number.isFinite(prev) || prev <= 0) return null
      return ((r.totalAmount - prev) / prev) * 100
    })

    return { rows, totals, itemQtys, growthPct }
  }, [yearSales, yearKey, employeeIdForGrowth])

  const compareGrowth = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => monthKeyFrom(yearKey, i))
    const selected = compareEmployeeIds.filter((id) => employees.some((e) => e.id === id && e.active))
    const series = selected.map((employeeId) => {
      const totalsByMonth = new Map<string, number>()
      for (const m of months) totalsByMonth.set(m, 0)
      for (const s of yearSales) {
        if (s.employeeId !== employeeId) continue
        totalsByMonth.set(s.monthKey, (totalsByMonth.get(s.monthKey) ?? 0) + s.amount)
      }
      const totals = months.map((m) => totalsByMonth.get(m) ?? 0)
      const totalYtd = totals.reduce((sum, x) => sum + x, 0)
      return { employeeId, months, totals, totalYtd }
    })

    const allValues = series.flatMap((s) => s.totals)
    const max = allValues.length > 0 ? Math.max(...allValues, 0) : 0
    return { months, series, domainMin: 0, domainMax: max }
  }, [compareEmployeeIds, employees, yearSales, yearKey])

  const employeeMonthSalesDetail = useMemo(() => {
    const employee = employeeById.get(employeeIdForGrowth) ?? null
    const monthKey = detailMonthKey || monthIso
    const list = yearSales
      .filter((s) => s.employeeId === employeeIdForGrowth && s.monthKey === monthKey)
      .slice()
      .sort((a, b) => (a.saleDateIso < b.saleDateIso ? 1 : a.saleDateIso > b.saleDateIso ? -1 : 0))
    const totalAmount = list.reduce((sum, s) => sum + s.amount, 0)
    const itemLines = list.reduce((sum, s) => sum + (s.items?.length ?? 0), 0)
    const itemQty = list.reduce(
      (sum, s) => sum + (s.items?.reduce((s2, it) => s2 + it.qty, 0) ?? 0),
      0,
    )
    return { employee, monthKey, list, totalAmount, itemLines, itemQty }
  }, [detailMonthKey, employeeById, employeeIdForGrowth, monthIso, yearSales])

  if (!auth.user) {
    return (
      <div className="stack">
        <section className="card stack">
          <div style={{ fontWeight: 800, fontSize: 16 }}>สรุปยอดขาย</div>
          <div className="hint">กรุณาเข้าสู่ระบบก่อน เพื่อดูข้อมูลจาก Firestore</div>
        </section>
      </div>
    )
  }

  return (
    <div className="stack">
      {error ? <div className="errorBox">{error}</div> : null}

      <section className="card stack">
        <div style={{ fontWeight: 800, fontSize: 16 }}>สรุปยอดขาย</div>

        <div className="grid2">
          <div className="row">
            <label>เลือกเดือน</label>
            <input type="month" value={monthIso} onChange={(e) => setMonthIso(e.target.value)} />
          </div>
          <div className="actions" style={{ alignItems: 'end' }}>
            <button
              type="button"
              className="primaryBtn"
              onClick={() => void refreshSales()}
              disabled={loading}
            >
              โหลดข้อมูลยอดขาย
            </button>
            <button
              type="button"
              className="secondaryBtn"
              onClick={() => void refreshMasterData()}
              disabled={loading}
            >
              รีเฟรชสาขา/พนักงาน
            </button>
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="hint">MTD (เดือน {monthIso})</div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{formatAmount(mtdTotalAmount)}</div>
            <div className="hint">จำนวนรายการ: {sales.length}</div>
          </div>
          <div className="card">
            <div className="hint">YTD (ปี {yearKey})</div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{formatAmount(ytdTotalAmount)}</div>
            <div className="hint">จำนวนรายการ: {yearSales.length}</div>
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="hint">Top 5 พนักงาน (MTD)</div>
            {topEmployees.length === 0 ? (
              <div className="hint">ยังไม่มีข้อมูล</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>พนักงาน</th>
                    <th>ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {topEmployees.map((x) => {
                    const e = employeeById.get(x.employeeId)
                    return (
                      <tr key={x.employeeId}>
                        <td>{e ? employeeDisplayName(e) : '-'}</td>
                        <td>{formatAmount(x.total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <div className="hint">Top 5 พนักงาน (YTD)</div>
            {topEmployeesYear.length === 0 ? (
              <div className="hint">ยังไม่มีข้อมูล</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>พนักงาน</th>
                    <th>ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {topEmployeesYear.map((x) => {
                    const e = employeeById.get(x.employeeId)
                    return (
                      <tr key={x.employeeId}>
                        <td>{e ? employeeDisplayName(e) : '-'}</td>
                        <td>{formatAmount(x.total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      <section className="card stack">
        <div style={{ fontWeight: 800, fontSize: 16 }}>การเติบโตยอดขายรายพนักงาน (รายเดือน)</div>

        <div className="grid2">
          <div className="row">
            <label>เลือกพนักงาน</label>
            <select
              value={employeeIdForGrowth}
              onChange={(e) => setEmployeeIdForGrowth(e.target.value)}
            >
              {employees
                .filter((e) => e.active)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {employeeDisplayName(e)}
                  </option>
                ))}
            </select>
          </div>
          <div className="row">
            <label>ปี</label>
            <input value={yearKey} disabled />
            <div className="hint">อ้างอิงปีจากเดือนที่เลือกในส่วนสรุปด้านบน</div>
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="hint">กราฟยอดขายรวม (บาท) รายเดือน</div>
            <div className="sparklineWrap">
              <svg className="sparkline" viewBox="0 0 360 120" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="rgba(123, 97, 255, 0.95)"
                  strokeWidth="3"
                  points={sparklinePoints(employeeGrowth.totals, 360, 120)}
                />
              </svg>
            </div>
          </div>
          <div className="card">
            <div className="hint">กราฟจำนวนสินค้า/บริการ (รวม qty) รายเดือน</div>
            <div className="sparklineWrap">
              <svg className="sparkline" viewBox="0 0 360 120" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.7)"
                  strokeWidth="3"
                  points={sparklinePoints(employeeGrowth.itemQtys, 360, 120)}
                />
              </svg>
            </div>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>เดือน</th>
              <th>ยอดขายรวม</th>
              <th>เติบโต MoM</th>
              <th>จำนวนบิล</th>
              <th>จำนวนรายการ</th>
              <th>จำนวนสินค้า/บริการ (qty)</th>
            </tr>
          </thead>
          <tbody>
            {employeeGrowth.rows.map((r, idx) => {
              const g = employeeGrowth.growthPct[idx]
              const gText = g === null ? '-' : `${g.toFixed(1)}%`
              const gColor =
                g === null ? 'inherit' : g > 0 ? 'rgba(106, 255, 163, 0.95)' : 'rgba(255, 120, 120, 0.95)'
              return (
                <tr
                  key={r.monthKey}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDetailMonthKey(r.monthKey)}
                >
                  <td>{r.monthKey}</td>
                  <td>{formatAmount(r.totalAmount)}</td>
                  <td style={{ color: gColor, fontWeight: 800 }}>{gText}</td>
                  <td>{r.billCount}</td>
                  <td>{r.itemLines}</td>
                  <td>{r.itemQty}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="card stack">
          <div style={{ fontWeight: 800 }}>
            รายการขายของ {employeeMonthSalesDetail.employee ? employeeDisplayName(employeeMonthSalesDetail.employee) : '-'} — {employeeMonthSalesDetail.monthKey}
          </div>
          <div className="grid2">
            <div className="row">
              <label>เลือกเดือน</label>
              <select value={employeeMonthSalesDetail.monthKey} onChange={(e) => setDetailMonthKey(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => monthKeyFrom(yearKey, i)).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="actions" style={{ alignItems: 'end' }}>
              <div className="row" style={{ minWidth: 220 }}>
                <label>รูปแบบส่งออก</label>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}>
                  <option value="singleItem">คอลัมน์เดียว (item)</option>
                  <option value="billSummary">สรุปบิล (หลายคอลัมน์)</option>
                  <option value="itemRows">แยกแถวตาม item (หลายคอลัมน์)</option>
                </select>
              </div>
              <button
                type="button"
                className="secondaryBtn"
                onClick={() => {
                  const employeeName = employeeMonthSalesDetail.employee
                    ? employeeDisplayName(employeeMonthSalesDetail.employee)
                    : 'employee'
                  const monthKey = employeeMonthSalesDetail.monthKey
                  let header: string[] = []
                  let rows: string[][] = []

                  if (exportFormat === 'billSummary') {
                    header = ['saleDateIso', 'amount', 'itemsCount', 'note']
                    rows = employeeMonthSalesDetail.list.map((s) => [
                      s.saleDateIso,
                      String(s.amount),
                      String(s.items?.length ?? 0),
                      s.note ?? '',
                    ])
                  } else if (exportFormat === 'itemRows') {
                    header = ['saleDateIso', 'itemName', 'qty', 'price', 'lineTotal', 'note']
                    rows = employeeMonthSalesDetail.list.flatMap((s) => {
                      const items = s.items ?? []
                      return items.map((it) => [
                        s.saleDateIso,
                        it.name,
                        String(it.qty),
                        String(it.price),
                        String(it.qty * it.price),
                        s.note ?? '',
                      ])
                    })
                  } else {
                    header = ['item']
                    rows = employeeMonthSalesDetail.list.flatMap((s) => {
                      const note = s.note?.trim()
                      const base = note ? `${s.saleDateIso} | ${note} | ` : `${s.saleDateIso} | `
                      const items = s.items ?? []
                      return items.map((it) => [`${base}${it.name} x${it.qty} @${it.price}`])
                    })
                  }

                  const csvHeader = header.map(csvEscape).join(',')
                  const csvLines = rows.map((r) => r.map(csvEscape).join(','))
                  const csv = [csvHeader, ...csvLines].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${safeFileName(`sales_${employeeName}_${monthKey}`)}.csv`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                }}
                disabled={
                  exportFormat === 'billSummary'
                    ? employeeMonthSalesDetail.list.length === 0
                    : employeeMonthSalesDetail.itemLines === 0
                }
              >
                ส่งออก CSV
              </button>
            </div>
          </div>

          <div className="grid2">
            <div className="card">
              <div className="hint">ยอดขายรวม</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{formatAmount(employeeMonthSalesDetail.totalAmount)}</div>
              <div className="hint">จำนวนบิล: {employeeMonthSalesDetail.list.length}</div>
            </div>
            <div className="card">
              <div className="hint">รวมรายการ/จำนวน (จาก items)</div>
              <div className="hint">จำนวนรายการ: {employeeMonthSalesDetail.itemLines}</div>
              <div className="hint">จำนวน qty: {employeeMonthSalesDetail.itemQty}</div>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ยอดขาย</th>
                <th>รายการ</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {employeeMonthSalesDetail.list.length === 0 ? (
                <tr>
                  <td className="hint" colSpan={4}>
                    ยังไม่มีข้อมูลในเดือนนี้
                  </td>
                </tr>
              ) : (
                employeeMonthSalesDetail.list.map((s) => (
                  <tr key={s.id}>
                    <td>{s.saleDateIso}</td>
                    <td>{formatAmount(s.amount)}</td>
                    <td>
                      {s.items && s.items.length > 0 ? (
                        <div className="stack">
                          {s.items.map((it, idx) => (
                            <div key={idx} className="hint">
                              {it.name} — {it.qty} x {formatAmount(it.price)} = {formatAmount(it.qty * it.price)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="hint">-</span>
                      )}
                    </td>
                    <td>{s.note ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <div style={{ fontWeight: 800, fontSize: 16 }}>เปรียบเทียบยอดขายรายพนักงาน (รายเดือน)</div>
        <div className="hint">เลือกได้หลายคนเพื่อดูแนวโน้มในกราฟเดียว</div>

        <div className="grid2">
          <div className="row">
            <label>เลือกพนักงาน (สูงสุด 5)</label>
            <div className="chipList">
              {employees
                .filter((e) => e.active)
                .slice(0, 40)
                .map((e) => {
                  const checked = compareEmployeeIds.includes(e.id)
                  const disable = !checked && compareEmployeeIds.length >= 5
                  return (
                    <label key={e.id} className="chip">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disable}
                        onChange={(ev) => {
                          const next = ev.target.checked
                            ? [...compareEmployeeIds, e.id]
                            : compareEmployeeIds.filter((x) => x !== e.id)
                          setCompareEmployeeIds(next)
                        }}
                      />
                      <span>{employeeDisplayName(e)}</span>
                    </label>
                  )
                })}
            </div>
          </div>
          <div className="row">
            <label>ปี</label>
            <input value={yearKey} disabled />
          </div>
        </div>

        {compareGrowth.series.length === 0 ? (
          <div className="hint">เลือกพนักงานอย่างน้อย 1 คน</div>
        ) : (
          <>
            <div className="card">
              <div className="hint">กราฟยอดขายรวม (บาท) รายเดือน</div>
              <div className="sparklineWrap">
                <svg className="sparkline" viewBox="0 0 360 120" preserveAspectRatio="none">
                  {compareGrowth.series.map((s, idx) => (
                    <polyline
                      key={s.employeeId}
                      fill="none"
                      stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      strokeWidth="3"
                      points={sparklinePointsDomain(
                        s.totals,
                        360,
                        120,
                        compareGrowth.domainMin,
                        compareGrowth.domainMax,
                      )}
                    />
                  ))}
                </svg>
              </div>
              <div className="legendList">
                {compareGrowth.series.map((s, idx) => {
                  const e = employeeById.get(s.employeeId)
                  return (
                    <div key={s.employeeId} className="legendItem">
                      <span
                        className="legendDot"
                        style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="legendText">
                        {e ? employeeDisplayName(e) : '-'} — {formatAmount(s.totalYtd)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>เดือน</th>
                  {compareGrowth.series.map((s, idx) => {
                    const e = employeeById.get(s.employeeId)
                    return (
                      <th key={s.employeeId} style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}>
                        {e ? employeeDisplayName(e) : '-'}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {compareGrowth.months.map((m, mIdx) => (
                  <tr key={m}>
                    <td>{m}</td>
                    {compareGrowth.series.map((s) => (
                      <td key={s.employeeId}>{formatAmount(s.totals[mIdx] ?? 0)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="card stack">
        <div style={{ fontWeight: 800, fontSize: 16 }}>ยอดขายตามสาขา</div>
        <table className="table">
          <thead>
            <tr>
              <th>สาขา</th>
              <th>ยอดขายรวม</th>
            </tr>
          </thead>
          <tbody>
            {totalByBranch.length === 0 ? (
              <tr>
                <td className="hint" colSpan={2}>
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              totalByBranch.map((x) => (
                <tr key={x.branchId}>
                  <td>{branchNameById.get(x.branchId) ?? '-'}</td>
                  <td>{formatAmount(x.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <div style={{ fontWeight: 800, fontSize: 16 }}>ยอดขายตามสาขา (YTD)</div>
        <table className="table">
          <thead>
            <tr>
              <th>สาขา</th>
              <th>ยอดขายรวม</th>
            </tr>
          </thead>
          <tbody>
            {totalByBranchYear.length === 0 ? (
              <tr>
                <td className="hint" colSpan={2}>
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              totalByBranchYear.map((x) => (
                <tr key={x.branchId}>
                  <td>{branchNameById.get(x.branchId) ?? '-'}</td>
                  <td>{formatAmount(x.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
