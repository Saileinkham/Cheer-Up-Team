import type { Employee } from '../types'

export function employeeDisplayName(e: Employee): string {
  const full = `${e.firstName} ${e.lastName}`.trim()
  const nick = e.nickName.trim()
  if (nick) return `${full} (${nick})`
  return full
}

