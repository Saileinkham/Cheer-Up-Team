import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Branch, Employee } from '../types'
import { listBranches, listEmployees, listSalesByDateRange } from '../lib/firestore'
import { currentMonthIso, monthRange } from '../lib/dates'
import { employeeDisplayName } from '../lib/employee'
import { formatAmount } from '../lib/format'

type BranchWinner = {
  branchId: string
  employeeId: string
  total: number
}

export function LeaderboardPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [monthIso, setMonthIso] = useState(currentMonthIso())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>()
    employees.forEach((e) => map.set(e.id, e))
    return map
  }, [employees])

  const [computedWinners, setComputedWinners] = useState<BranchWinner[]>([])

  const refresh = useCallback(async () => {
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
  }, [])

  const computeForMonth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const range = monthRange(monthIso)
      const sales = await listSalesByDateRange(range)

      const sumByBranchEmployee = new Map<string, number>()
      for (const s of sales) {
        const key = `${s.branchId}::${s.employeeId}`
        sumByBranchEmployee.set(key, (sumByBranchEmployee.get(key) ?? 0) + s.amount)
      }

      const winnersByBranch = new Map<string, BranchWinner>()
      for (const [key, total] of sumByBranchEmployee.entries()) {
        const [branchId, employeeId] = key.split('::')
        const current = winnersByBranch.get(branchId)
        if (!current || total > current.total) {
          winnersByBranch.set(branchId, { branchId, employeeId, total })
        }
      }

      const output: BranchWinner[] = branches
        .map((b) => winnersByBranch.get(b.id))
        .filter((x): x is BranchWinner => Boolean(x))
        .sort((a, b) => b.total - a.total)

      setComputedWinners(output)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setComputedWinners([])
    } finally {
      setLoading(false)
    }
  }, [monthIso, branches])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (branches.length === 0) return
    void computeForMonth()
  }, [branches, computeForMonth])

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>()
    branches.forEach((b) => map.set(b.id, b.name))
    return map
  }, [branches])

  const overall = useMemo(() => {
    if (computedWinners.length === 0) return null
    return computedWinners[0]!
  }, [computedWinners])

  return (
    <div className="stack">
      {error ? <div className="errorBox">{error}</div> : null}

      <section className="card stack">
        <div style={{ fontWeight: 800, fontSize: 16 }}>พนักงานยอดเยี่ยมแต่ละสาขา</div>

        <div className="grid2">
          <div className="row">
            <label>เลือกเดือน</label>
            <input type="month" value={monthIso} onChange={(e) => setMonthIso(e.target.value)} />
            <div className="hint">ระบบจะสรุปจากข้อมูลการขายในเดือนที่เลือก</div>
          </div>
          <div className="actions" style={{ alignItems: 'end' }}>
            <button
              type="button"
              className="primaryBtn"
              onClick={() => void computeForMonth()}
              disabled={loading}
            >
              สรุปใหม่
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

        {overall ? (
          <div className="card">
            <div style={{ fontWeight: 800 }}>อันดับ 1 รวม (จากผู้ชนะของแต่ละสาขา)</div>
            <div className="hint">
              {branchNameById.get(overall.branchId) ?? '-'} —{' '}
              {employeeById.get(overall.employeeId)
                ? employeeDisplayName(employeeById.get(overall.employeeId)!)
                : '-'}{' '}
              — {formatAmount(overall.total)}
            </div>
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <table className="table">
          <thead>
            <tr>
              <th>สาขา</th>
              <th>พนักงานยอดเยี่ยม</th>
              <th>ยอดขายรวม</th>
            </tr>
          </thead>
          <tbody>
            {computedWinners.length === 0 ? (
              <tr>
                <td className="hint" colSpan={3}>
                  ยังไม่มีข้อมูลเพียงพอสำหรับสรุป (เพิ่มข้อมูลยอดขายก่อน)
                </td>
              </tr>
            ) : (
              computedWinners.map((w) => {
                const employee = employeeById.get(w.employeeId)
                return (
                  <tr key={w.branchId}>
                    <td>{branchNameById.get(w.branchId) ?? '-'}</td>
                    <td>
                      {employee ? (
                        <span className="badge">
                          {employee.photoUrl ? (
                            <img className="avatar" src={employee.photoUrl} alt="" />
                          ) : null}
                          {employeeDisplayName(employee)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{formatAmount(w.total)}</td>
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
