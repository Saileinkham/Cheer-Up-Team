import { useMemo, useState } from 'react'
import './App.css'
import { Layout, type AppTab } from './components/Layout'
import { getFirebase } from './lib/firebase'
import { AuthProvider } from './lib/AuthProvider'
import { NewDashboardPage } from './pages/NewDashboardPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { SalesUpdatePage } from './pages/SalesUpdatePage'
import { CheerItemsPage } from './pages/CheerItemsPage'
import { LoginPage } from './pages/LoginPage'
import { useAuth } from './lib/authContext'

function AppAuthed() {
  const auth = useAuth()
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard')

  if (auth.loading) {
    return (
      <div className="appBootstrap">
        <div className="card stack">
          <div style={{ fontWeight: 900, fontSize: 18 }}>กำลังตรวจสอบผู้ใช้…</div>
          <div className="hint">โปรดรอสักครู่</div>
        </div>
      </div>
    )
  }

  if (!auth.user) return <LoginPage />

  return (
    <Layout activeTab={activeTab} onChangeTab={setActiveTab}>
      {activeTab === 'dashboard' ? <NewDashboardPage /> : null}
      {activeTab === 'employees' ? <EmployeesPage /> : null}
      {activeTab === 'sales' ? <SalesUpdatePage /> : null}
      {activeTab === 'cheerItems' ? <CheerItemsPage /> : null}
    </Layout>
  )
}

function App() {
  const firebaseError = useMemo(() => {
    try {
      getFirebase()
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }, [])

  if (firebaseError) {
    return (
      <div className="appBootstrap">
        <div className="card stack">
          <div style={{ fontWeight: 900, fontSize: 18 }}>ตั้งค่า Firebase ก่อนใช้งาน</div>
          <div className="errorBox">{firebaseError}</div>
          <div className="hint">
            สร้างไฟล์ <b>.env</b> (อ้างอิงจาก <b>.env.example</b>) แล้วใส่ค่า Firebase Config จาก
            Firebase Console จากนั้นรีสตาร์ท dev server
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <AppAuthed />
    </AuthProvider>
  )
}

export default App
