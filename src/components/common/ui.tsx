import { Archive } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AIEvent, Device } from '../../types'
import { useChangeFeedback } from '../../hooks/useChangeFeedback'

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'violet' | 'teal'

export function Badge({ tone = 'slate', dot, children, feedbackKey, className }: { tone?: Tone; dot?: boolean; children: ReactNode; feedbackKey?: string; className?: string }) {
  const feedbackRef = useChangeFeedback<HTMLSpanElement>(feedbackKey, 'badge-motion')
  return <span ref={feedbackRef} className={`badge tone-${tone}${className ? ` ${className}` : ''}`}>{dot && <span className="badge-dot" aria-hidden="true" />}{children}</span>
}

const deviceStatus = {
  online: { label: '在线', tone: 'green' },
  offline: { label: '离线', tone: 'slate' },
  unknown: { label: '连接未判定', tone: 'slate' },
} as const

export const deviceSourceLabels = { mock: '模拟数据', hardware: '真实设备' } as const

export function DeviceStatus({ connection, source }: Pick<Device, 'connection' | 'source'>) {
  const { label, tone } = deviceStatus[connection]
  const appearance = connection === 'unknown' ? 'device-status--unknown' : source === 'mock' && connection === 'online' ? 'device-status--mock-online' : undefined
  return <Badge tone={tone} dot className={appearance}>{source === 'mock' && connection !== 'unknown' ? `模拟${label}` : label}</Badge>
}

export function EventStatus({ outcome }: { outcome: AIEvent['outcome'] }) {
  return <Badge tone={outcome === 'success' ? 'slate' : 'red'} dot>{outcome === 'success' ? '请求已完成' : '请求失败'}</Badge>
}

export function PageHeader({ title, description, eyebrow, actions }: { title: string; description: string; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {/* Kept for screen readers; the large title carries the page visually, as in Apple apps. */}
        <p className="visually-hidden">{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

// `icon` stays in the signature for existing callers; section titles are typographic only.
export function Panel({ title, subtitle, action, className = '', children }: {
  title?: string; subtitle?: string; icon?: LucideIcon; action?: ReactNode; className?: string; children: ReactNode
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || subtitle || action) && <div className="panel-header">
        <div>
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="panel-action">{action}</div>}
      </div>}
      {children}
    </section>
  )
}

// `icon` and `tone` stay in the signature for existing callers; figures are shown without icon tiles.
export function MetricCard({ label, value, caption, highlightChanges }: {
  label: string; value: ReactNode; icon: LucideIcon; tone?: Tone; caption?: ReactNode; highlightChanges?: boolean
}) {
  const flashRef = useChangeFeedback<HTMLSpanElement>(highlightChanges ? value : undefined, 'motion-update')
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{highlightChanges && <span ref={flashRef} className="metric-flash" aria-hidden="true" />}{value}</div>
      {caption && <div className="metric-caption">{caption}</div>}
    </article>
  )
}

export function EmptyState({ title, description, icon: Icon = Archive, action }: { title: string; description: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="tone-icon tone-slate"><Icon size={21} aria-hidden="true" /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}
