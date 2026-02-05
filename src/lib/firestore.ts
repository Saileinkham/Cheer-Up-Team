import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { getFirebase } from './firebase'
import type { Branch, CheerItem, Employee, Sale, SaleItem } from '../types'

const COLLECTIONS = {
  branches: 'branches',
  employees: 'employees',
  sales: 'sales',
  cheerItems: 'cheerItems',
} as const

function toIsoDate(value: Timestamp | Date): string {
  const date = value instanceof Date ? value : value.toDate()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMonthKey(value: Timestamp | Date): string {
  const date = value instanceof Date ? value : value.toDate()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function toYearKey(value: Timestamp | Date): string {
  const date = value instanceof Date ? value : value.toDate()
  return String(date.getFullYear())
}

function normalizeItems(input: unknown): SaleItem[] | undefined {
  if (!Array.isArray(input)) return undefined

  const items: SaleItem[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const obj = raw as Record<string, unknown>
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    const qty = Number(obj.qty)
    const price = Number(obj.price)
    if (!name) continue
    if (!Number.isFinite(qty) || qty <= 0) continue
    if (!Number.isFinite(price) || price < 0) continue
    items.push({ name, qty, price })
  }

  return items.length > 0 ? items : undefined
}

function normalizeCheerItemDoc(id: string, data: DocumentData): CheerItem {
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const price = Number(data.price ?? 0)
  const active = Boolean(data.active ?? true)
  return { id, name, price: Number.isFinite(price) && price >= 0 ? price : 0, active }
}

export async function listBranches(): Promise<Branch[]> {
  const { db } = getFirebase()
  const q = query(collection(db, COLLECTIONS.branches), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? '') }))
}

export async function createBranch(name: string): Promise<void> {
  const { db } = getFirebase()
  const trimmed = name.trim()
  if (!trimmed) return
  await addDoc(collection(db, COLLECTIONS.branches), { name: trimmed, createdAt: serverTimestamp() })
}

export async function listEmployees(): Promise<Employee[]> {
  const { db } = getFirebase()
  const q = query(collection(db, COLLECTIONS.employees), orderBy('firstName', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      firstName: String(data.firstName ?? ''),
      lastName: String(data.lastName ?? ''),
      nickName: String(data.nickName ?? ''),
      photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
      branchId: String(data.branchId ?? ''),
      active: Boolean(data.active ?? true),
    }
  })
}

export async function createEmployee(input: {
  firstName: string
  lastName: string
  nickName: string
  photoUrl?: string
  branchId: string
  active?: boolean
}): Promise<void> {
  const { db } = getFirebase()
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const nickName = input.nickName.trim()
  const branchId = input.branchId.trim()
  if (!firstName || !lastName || !branchId) return

  const photoUrl = input.photoUrl?.trim()

  await addDoc(collection(db, COLLECTIONS.employees), {
    firstName,
    lastName,
    nickName,
    photoUrl: photoUrl ? photoUrl : null,
    branchId,
    active: input.active ?? true,
    createdAt: serverTimestamp(),
  })
}

export async function listCheerItems(): Promise<CheerItem[]> {
  const { db } = getFirebase()
  const q = query(collection(db, COLLECTIONS.cheerItems), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => normalizeCheerItemDoc(d.id, d.data() as DocumentData))
}

export async function createCheerItem(input: { name: string; price: number; active?: boolean }): Promise<void> {
  const { db } = getFirebase()
  const name = input.name.trim()
  const price = Number(input.price)
  if (!name) return
  if (!Number.isFinite(price) || price < 0) return
  await addDoc(collection(db, COLLECTIONS.cheerItems), {
    name,
    price,
    active: input.active ?? true,
    createdAt: serverTimestamp(),
  })
}

export async function updateCheerItem(
  id: string,
  input: { name?: string; price?: number; active?: boolean },
): Promise<void> {
  const { db } = getFirebase()
  const trimmed = id.trim()
  if (!trimmed) return

  const patch: Record<string, unknown> = {}
  if (typeof input.name === 'string') {
    const name = input.name.trim()
    if (name) patch.name = name
  }
  if (typeof input.price === 'number') {
    if (Number.isFinite(input.price) && input.price >= 0) patch.price = input.price
  }
  if (typeof input.active === 'boolean') patch.active = input.active
  if (Object.keys(patch).length === 0) return

  await updateDoc(doc(db, COLLECTIONS.cheerItems, trimmed), patch)
}

export async function deleteCheerItem(id: string): Promise<void> {
  const { db } = getFirebase()
  const trimmed = id.trim()
  if (!trimmed) return
  await deleteDoc(doc(db, COLLECTIONS.cheerItems, trimmed))
}

export async function createSale(input: {
  employeeId: string
  branchId: string
  amount: number
  customers?: number
  saleDateIso: string
  items?: SaleItem[]
  note?: string
}): Promise<void> {
  const { db } = getFirebase()
  const employeeId = input.employeeId.trim()
  const branchId = input.branchId.trim()
  if (!employeeId || !branchId) return

  const date = new Date(`${input.saleDateIso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return

  const items = normalizeItems(input.items)
  const computedFromItems = items?.reduce((sum, x) => sum + x.qty * x.price, 0) ?? 0

  const rawAmount = Number(input.amount)
  const amount =
    Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : items ? computedFromItems : Number.NaN
  if (!Number.isFinite(amount) || amount <= 0) return

  const customers = input.customers == null ? undefined : Number(input.customers)
  const safeCustomers =
    customers != null && Number.isFinite(customers) && customers >= 0 ? Math.floor(customers) : undefined

  const doc: Record<string, unknown> = {
    employeeId,
    branchId,
    amount,
    saleDate: Timestamp.fromDate(date),
    monthKey: toMonthKey(date),
    yearKey: toYearKey(date),
    createdAt: serverTimestamp(),
  }

  if (items) doc.items = items
  if (safeCustomers != null) doc.customers = safeCustomers

  const note = input.note?.trim()
  if (note) doc.note = note

  await addDoc(collection(db, COLLECTIONS.sales), doc)
}

export async function deleteSale(saleId: string): Promise<void> {
  const { db } = getFirebase()
  const id = saleId.trim()
  if (!id) return
  await deleteDoc(doc(db, COLLECTIONS.sales, id))
}

export async function deleteSalesForEmployee(employeeId: string): Promise<number> {
  const { db } = getFirebase()
  const id = employeeId.trim()
  if (!id) return 0

  const q = query(collection(db, COLLECTIONS.sales), where('employeeId', '==', id))
  const snap = await getDocs(q)
  if (snap.empty) return 0

  let deleted = 0
  let batch = writeBatch(db)
  let ops = 0

  for (const d of snap.docs) {
    batch.delete(d.ref)
    deleted += 1
    ops += 1

    if (ops >= 450) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }

  if (ops > 0) await batch.commit()
  return deleted
}

export async function listSalesByDateRange(input: {
  start: Date
  endExclusive: Date
}): Promise<Sale[]> {
  const { db } = getFirebase()
  const startTs = Timestamp.fromDate(input.start)
  const endTs = Timestamp.fromDate(input.endExclusive)

  const q = query(
    collection(db, COLLECTIONS.sales),
    where('saleDate', '>=', startTs),
    where('saleDate', '<', endTs),
    orderBy('saleDate', 'desc'),
  )

  const snap = await getDocs(q)

  return snap.docs.map((d) => {
    const data = d.data() as DocumentData
    const saleDate = data.saleDate as Timestamp
    const parsedItems = normalizeItems(data.items)
    return {
      id: d.id,
      employeeId: String(data.employeeId ?? ''),
      branchId: String(data.branchId ?? ''),
      amount: Number(data.amount ?? 0),
      customers:
        Number.isFinite(Number(data.customers)) && Number(data.customers) >= 0
          ? Math.floor(Number(data.customers))
          : undefined,
      saleDateIso: toIsoDate(saleDate),
      monthKey: typeof data.monthKey === 'string' ? data.monthKey : toMonthKey(saleDate),
      yearKey: typeof data.yearKey === 'string' ? data.yearKey : toYearKey(saleDate),
      items: parsedItems,
      note: typeof data.note === 'string' ? data.note : undefined,
    }
  })
}
