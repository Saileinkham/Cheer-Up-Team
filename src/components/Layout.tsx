import type { ReactNode } from 'react'
import './layout.css'
import { useAuth } from '../lib/authContext'

export type AppTab = 'dashboard' | 'employees' | 'sales' | 'cheerItems'

const TAB_LABEL: Record<AppTab, string> = {
  dashboard: 'Dashboard',
  employees: 'ทะเบียนพนักงาน',
  sales: 'อัปเดตรายการขาย',
  cheerItems: 'รายการเชียร์ขาย',
}

export function Layout(props: {
  activeTab: AppTab
  onChangeTab: (tab: AppTab) => void
  children: ReactNode
}) {
  const auth = useAuth()

  return (
    <div className="layoutRoot">
      <aside className="layoutSidebar">
        <div className="layoutSidebarHeader">
          <div className="layoutTitle">Cheer Up Sales</div>
          <div className="layoutSubtitle">ระบบบันทึกยอดขายพนักงาน</div>
        </div>

        <nav className="layoutSidebarNav">
          {(Object.keys(TAB_LABEL) as AppTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === props.activeTab ? 'layoutSideItem active' : 'layoutSideItem'}
              onClick={() => props.onChangeTab(tab)}
            >
              {TAB_LABEL[tab]}
            </button>
          ))}
        </nav>

        <div className="layoutSidebarFooter">
          {auth.loading ? (
            <div className="hint">กำลังตรวจสอบผู้ใช้…</div>
          ) : auth.user ? (
            <>
              <div className="hint">
                {auth.user.email ?? 'ผู้ใช้'}{' '}
                {auth.role === 'admin' ? '(Admin)' : auth.role === 'manager' ? '(Manager)' : '(Staff)'}
              </div>
              <button type="button" className="secondaryBtn" onClick={() => void auth.signOut()}>
                ออกจากระบบ
              </button>
            </>
          ) : null}
        </div>
      </aside>

      <div className="layoutContent">
        <header className="layoutMobileHeader">
          <div className="layoutMobileTitle">{TAB_LABEL[props.activeTab]}</div>
        </header>
        <main className="layoutMain">{props.children}</main>
      </div>
    </div>
  )
}
