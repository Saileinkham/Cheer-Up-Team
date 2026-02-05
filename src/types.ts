export type Branch = {
  id: string
  name: string
}

export type Employee = {
  id: string
  firstName: string
  lastName: string
  nickName: string
  photoUrl?: string
  branchId: string
  active: boolean
}

export type SaleItem = {
  name: string
  qty: number
  price: number
}

export type CheerItem = {
  id: string
  name: string
  price: number
  active: boolean
}

export type UserRole = 'admin' | 'manager' | 'staff'

export type UserAccess = {
  email: string
  role: UserRole
  primaryAdmin?: boolean
}

export type Sale = {
  id: string
  employeeId: string
  branchId: string
  amount: number
  customers?: number
  saleDateIso: string
  monthKey: string
  yearKey: string
  items?: SaleItem[]
  note?: string
}
