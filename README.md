# ระบบบันทึกยอดขายพนักงาน (Firebase)

เว็บสำหรับเก็บข้อมูลการขายของพนักงาน และสรุป “พนักงานขายยอดเยี่ยม” แยกตามสาขา โดยเก็บข้อมูลบน Firebase (Firestore)

## ฟีเจอร์

- ตั้งค่า “สาขา” และ “พนักงาน” (รูป/ชื่อ/นามสกุล/ชื่อเล่น/สาขา)
- เพิ่มยอดขายรายวันของพนักงาน (รองรับ “รายการขาย” หลายรายการต่อบิล)
- สรุป MTD (รายเดือน) และ YTD (รายปี) + Top 5 พนักงาน
- จัดอันดับพนักงานยอดเยี่ยม “แต่ละสาขา” ตามเดือนที่เลือก

## เทคโนโลยี

- React + TypeScript (Vite)
- Firebase Firestore (Web SDK)
- Firebase Auth (Google Sign-in)

## เริ่มต้นใช้งาน

1) สร้าง Firebase Project และเปิดใช้งาน Firestore

1.1) เปิดใช้งาน Firebase Authentication

- ไปที่ Firebase Console → Authentication → Sign-in method → เปิดใช้งาน Email/Password
- (ถ้าต้องการ) เปิดใช้งาน Google เพิ่มได้

2) ตั้งค่า Environment

- คัดลอกไฟล์ `.env.example` เป็น `.env`
- ใส่ค่า Firebase Config จาก Firebase Console → Project settings → Your apps

3) รันโปรเจกต์

```bash
npm install
npm run dev
```

## ตั้งค่า Admin (Custom Claims)

ระบบจะใช้ custom claim `role` เพื่อกำหนดสิทธิ์

- `admin`: ลบข้อมูลได้ (เช่น ลบยอดขายพนักงาน)
- `manager`: เพิ่ม/แก้ไข master data ได้ (สาขา/พนักงาน)
- `staff`: บันทึกยอดขาย/ดูรายงานได้

1) สร้าง Service Account Key

- Firebase Console → Project settings → Service accounts → Generate new private key
- เก็บไฟล์ JSON ไว้ในเครื่อง (อย่าอัปโหลดขึ้น Git)

2) ตั้งค่า Role ให้ผู้ใช้

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
npm run set-admin -- --email=you@example.com --role=admin
```

ผู้ใช้ต้องออก-เข้าใหม่ (หรือรีเฟรช token) เพื่อให้ claim ใหม่มีผล

## Security Rules (แนะนำ)

ไฟล์ rules อยู่ที่ `firestore.rules` และ `firebase.json`

- ตั้งค่า role ด้วย custom claims แล้ว rules จะตรวจ `request.auth.token.role`
- deploy ด้วย Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

## โครงสร้างข้อมูล (Firestore Collections)

- `branches`
  - `name: string`
- `employees`
  - `firstName: string`
  - `lastName: string`
  - `nickName: string`
  - `photoUrl: string | null`
  - `branchId: string`
  - `active: boolean`
- `sales`
  - `employeeId: string`
  - `branchId: string`
  - `amount: number`
  - `saleDate: Timestamp`
  - `monthKey: string` (เช่น 2026-02)
  - `yearKey: string` (เช่น 2026)
  - `items: { name, qty, price }[] (optional)`
  - `note: string (optional)`
