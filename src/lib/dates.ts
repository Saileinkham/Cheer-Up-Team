export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentMonthIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function currentYearKey(): string {
  return String(new Date().getFullYear())
}

export function monthRange(monthIso: string): { start: Date; endExclusive: Date } {
  const [y, m] = monthIso.split('-').map((x) => Number(x))
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0)
  const endExclusive = new Date(y, m, 1, 0, 0, 0, 0)
  return { start, endExclusive }
}

export function yearRange(yearKey: string): { start: Date; endExclusive: Date } {
  const y = Number(yearKey)
  const start = new Date(y, 0, 1, 0, 0, 0, 0)
  const endExclusive = new Date(y + 1, 0, 1, 0, 0, 0, 0)
  return { start, endExclusive }
}
