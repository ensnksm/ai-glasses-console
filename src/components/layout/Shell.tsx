import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, ChevronRight, Glasses, LogOut, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../services/auth'
import { ROLE_LABELS } from '../../services/permissions'
import { Badge } from '../common/ui'
import { WorkspaceLink } from '../workspace/workspaceContext'
import { groups } from '../workspace/workspaceRoutes'
import SidebarNavigation from './SidebarNavigation'
import { useLiquidGlass } from '../../hooks/useLiquidGlass'

export default function Shell({ activeTo, title, dock, children }: { activeTo?: string; title?: string; dock: ReactNode; children: ReactNode }) {
  const [logoutError, setLogoutError] = useState('')
  const sidebarRef = useRef<HTMLElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  useLiquidGlass(sidebarRef, { radius: 26, bezel: 26, depth: 16 })
  useLiquidGlass(actionsRef, { radius: 999, bezel: 14, depth: 9 })
  const { currentUser, can, logout } = useAuth()
  if (!currentUser) return null
  const available = groups.map(group => ({
    ...group,
    links: group.links.filter(({ permission }) => !permission || can(permission)),
  })).filter(group => group.links.length > 0)
  const role = ROLE_LABELS[currentUser.role]
  const initial = currentUser.id[0].toUpperCase()

  function signOut() {
    try { logout() } catch (error) {
      setLogoutError(error instanceof Error ? error.message : '退出失败，请重试。')
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="侧边栏" ref={sidebarRef}>
        <WorkspaceLink className="brand" to="/" aria-label="AI Glasses 实时监控">
          <span className="brand-mark"><Glasses size={23} strokeWidth={2.2} aria-hidden="true" /></span>
          <span><strong>AI Glasses</strong><small>智能眼镜管理平台</small></span>
        </WorkspaceLink>
        <SidebarNavigation groups={available} activeTo={activeTo} />
        <div className="sidebar-bottom">
          <div className="environment" title="本地演示 · Mock 数据">
            <span className="environment-icon"><Activity size={15} aria-hidden="true" /></span>
            <span><strong>本地演示</strong><small>Mock 数据 · 无硬件连接</small></span>
          </div>
          <div className="sidebar-account" title={`${currentUser.id} · ${role}`}>
            <span className="avatar" aria-hidden="true">{initial}</span>
            <span><strong>{currentUser.id}</strong><small>{role}</small></span>
          </div>
        </div>
      </aside>
      <div className="workspace-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>管理平台</span><ChevronRight size={13} aria-hidden="true" /><strong>{title ?? '工作台'}</strong></div>
          <div className="topbar-actions" ref={actionsRef}>
            <Badge tone="blue" dot>Mock 演示</Badge>
            <span className="topbar-separator" />
            <div className="topbar-account">
              <span className="avatar avatar--small" aria-hidden="true">{initial}</span>
              <div className="topbar-identity"><strong>{currentUser.id}</strong><small>{role}</small></div>
            </div>
            <button type="button" className="button button--quiet topbar-logout" aria-label="退出登录" title="退出登录" onClick={signOut}><LogOut size={15} aria-hidden="true" /><span>退出</span></button>
          </div>
        </header>
        {children}
        {dock}
      </div>
      {logoutError && <p className="shell-access-notice workspace-session-error" role="alert"><ShieldAlert size={16} aria-hidden="true" />{logoutError}</p>}
    </div>
  )
}
