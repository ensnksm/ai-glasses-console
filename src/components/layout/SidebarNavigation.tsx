import type { LucideIcon } from 'lucide-react'
import { useGlassSelection } from '../../hooks/useGlassSelection'
import { useWorkspace, WorkspaceLink } from '../workspace/workspaceContext'
import '../../styles/glass-motion.css'

type NavGroup = {
  label: string
  links: { to: string; name: string; icon: LucideIcon }[]
}

export default function SidebarNavigation({ groups, activeTo }: { groups: NavGroup[]; activeTo?: string }) {
  const { openWindow } = useWorkspace()
  const { hostProps, trackRef, indicatorRef, hoverIndicatorRef, focusIndicatorRef } = useGlassSelection<HTMLElement>(
    'y', activeTo, openWindow,
  )

  return (
    <nav {...hostProps} className="sidebar-nav glass-selection" aria-label="主导航">
      <div className="glass-track" ref={trackRef}>
        <span className="glass-hover-indicator" ref={hoverIndicatorRef} aria-hidden="true" />
        <span className="glass-indicator nav-glass-indicator" ref={indicatorRef} aria-hidden="true" />
        <span className="glass-focus-indicator" ref={focusIndicatorRef} aria-hidden="true" />
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.links.map(({ to, name, icon: Icon }) => (
              <WorkspaceLink key={to} to={to} aria-current={activeTo === to ? 'page' : undefined} data-glass-value={to} draggable={false} title={name} aria-label={name} className={`nav-link${activeTo === to ? ' nav-link--active' : ''}`}>
                <div className="nav-link-content">
                  <div className="nav-link-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.85} />
                    <Icon className="nav-link-icon-fill" size={18} strokeWidth={1.95} />
                  </div>
                  <span>{name}</span>
                </div>
              </WorkspaceLink>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}
