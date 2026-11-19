import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Clock3, FileText, LockKeyhole, Minus, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react'
import SearchInput from '../../components/common/SearchInput'
import { Badge, EmptyState, MetricCard, PageHeader, Panel } from '../../components/common/ui'
import { useAuth } from '../../services/auth'
import {
  ACCOUNT_STATUS_LABELS, BUSINESS_PERMISSIONS, DEMO_ADMIN_ID, ORDINARY_ROLES, ROLE_LABELS, canDo, roleAllows,
  type Account, type AccountStatus, type OrdinaryRole, type PermissionOverrides,
} from '../../services/permissions'
import './admin.css'

type AccountCommand = Parameters<ReturnType<typeof useAuth>['updateAccount']>[1]
type AccountAction = AccountCommand['type']
type StatusFilter = AccountStatus | 'all'

const statusTones = { pending: 'amber', active: 'green', rejected: 'red', disabled: 'slate' } as const
const statuses: AccountStatus[] = ['pending', 'active', 'disabled', 'rejected']
const overrideLabels = { inherit: '继承角色', allow: '允许', deny: '禁止' } as const
const dateFormat = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const auditDateFormat = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

function Table({ label, headings, children }: { label: string; headings: string[]; children: ReactNode }) {
  return <div className="table-wrap"><table className="data-table" aria-label={label}>
    <thead><tr>{headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table></div>
}

function DateCell({ value, precise = false }: { value: string; precise?: boolean }) {
  const time = new Date(value)
  return Number.isNaN(+time) ? <>—</> : <time className="mono admin-time" dateTime={value}>{(precise ? auditDateFormat : dateFormat).format(time)}</time>
}

function AccountBadge({ status }: { status: AccountStatus }) {
  return <Badge tone={statusTones[status]} dot>{ACCOUNT_STATUS_LABELS[status]}</Badge>
}

function PermissionIndicator({ allowed }: { allowed: boolean }) {
  return <span className={`admin-permission-indicator${allowed ? ' is-allowed' : ''}`}>
    {allowed ? <Check size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}{allowed ? '允许' : '未授权'}
  </span>
}

function RolesPanel() {
  const roles = ['superadmin', ...ORDINARY_ROLES] as const
  const rows = [
    { id: 'basic', label: '监控、设备、事件和显示偏好' },
    ...BUSINESS_PERMISSIONS,
    { id: 'manageAccounts', label: '审批与管理账号' },
    { id: 'manageSimulation', label: '控制模拟自动刷新' },
  ] as const

  return <Panel title="角色与权限" subtitle="这里显示角色默认权限。单独授权可覆盖普通角色的默认设置。" icon={ShieldCheck}>
    <Table label="角色默认权限" headings={['操作能力', ...roles.map((role) => ROLE_LABELS[role])]}>
      {rows.map(({ id, label }) => <tr key={id}>
        <th scope="row">{label}</th>
        {roles.map((role) => <td key={role}><PermissionIndicator allowed={id === 'basic' || roleAllows(role, id)} /></td>)}
      </tr>)}
    </Table>
  </Panel>
}

const accountTransitions = {
  reject: { title: '拒绝申请', previous: 'pending', next: 'rejected', description: '账号仍无法登录。你可以之后将这份申请退回待审批。' },
  reopen: { title: '退回待审批', previous: 'rejected', next: 'pending', description: '重新打开申请。账号仍需另行批准并分配角色后才能登录。' },
  disable: { title: '停用账号', previous: 'active', next: 'disabled', description: '该账号会失去后台访问权限，已有角色和单独设置会保留。' },
  enable: { title: '启用账号', previous: 'disabled', next: 'active', description: '该账号将可按现有角色和单独设置重新登录。' },
} as const

function isAccountTransition(action: AccountAction): action is keyof typeof accountTransitions {
  return action === 'reject' || action === 'reopen' || action === 'disable' || action === 'enable'
}

function PermissionList({ account }: { account: Account }) {
  const allowed = BUSINESS_PERMISSIONS.filter(({ id }) => canDo(account, id))
  return allowed.length ? <ul className="admin-permission-list" aria-label="生效的业务权限">
    {allowed.map(({ id, label }) => <li key={id}><Badge tone="blue">{label}</Badge></li>)}
  </ul> : <p className="admin-helper">仅基础查看和个人显示偏好。</p>
}

function sameOverrides(first: PermissionOverrides, second: PermissionOverrides) {
  return BUSINESS_PERMISSIONS.every(({ id }) => first[id] === second[id])
}

function AccountEditor({ original, latest, initialAction, onClose, onCommit }: {
  original: Account
  latest?: Account
  initialAction: AccountAction
  onClose: () => void
  onCommit: (id: string, command: AccountCommand) => void
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const [action, setAction] = useState(initialAction)
  const [role, setRole] = useState<OrdinaryRole | ''>(initialAction === 'approve' || original.role === 'superadmin' ? '' : original.role)
  const [overrides, setOverrides] = useState(original.overrides)
  const [review, setReview] = useState(false)
  const [error, setError] = useState('')
  const title = action === 'approve' ? '处理注册申请' : action === 'updateAccess' ? '编辑权限' : accountTransitions[action].title
  const stale = !latest || latest.status !== original.status || latest.role !== original.role || !sameOverrides(latest.overrides, original.overrides)
  const draft: Account | null = role ? { ...original, role, status: 'active', overrides } : null
  const previous: Account = { ...original, status: 'active' }
  const changed = draft ? BUSINESS_PERMISSIONS.filter(({ id }) => overrides[id] !== original.overrides[id] || canDo(previous, id) !== canDo(draft, id)) : []
  const roleChanged = Boolean(draft && draft.role !== original.role)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useLayoutEffect(() => {
    if (review || action !== initialAction) reviewHeading.current?.focus()
  }, [review, action, initialAction])

  function commit(command: AccountCommand) {
    if (stale) return
    setError('')
    try { onCommit(original.id, command) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '暂时无法保存，请重试。') }
  }

  const roleInput = <label className="admin-labeled-control">
    <span>分配角色</span>
    <select className="field-select" value={role} onChange={(event) => { setRole(event.target.value as OrdinaryRole | ''); setError('') }}>
      <option value="" disabled>请选择角色</option>
      {ORDINARY_ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
    </select>
  </label>

  return <dialog ref={dialogRef} className="admin-drawer" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <div className="admin-drawer-content">
      <header className="admin-drawer-header">
        <span className="tone-icon tone-blue" aria-hidden="true"><ShieldCheck size={19} /></span>
        <div><h2 id={titleId}>{title}</h2><p><span className="mono">{original.id}</span> · {ACCOUNT_STATUS_LABELS[original.status]}</p></div>
        <button type="button" className="icon-button" aria-label="关闭账户操作" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="admin-drawer-body">
        {stale ? <p className="admin-feedback admin-feedback--error" role="alert">该账号已在其他页面变更。请关闭后重新打开，再继续操作。</p> : <>
          {action === 'approve' && <>
            <section className="admin-editor-section"><h3>批准后，该账号就可以登录</h3><p>决定申请前，请先核对账号并选择它应该具有的角色。</p>{roleInput}</section>
            {draft && <section className="admin-editor-section"><h3>批准后可用的业务权限</h3><PermissionList account={draft} /></section>}
          </>}
          {action === 'updateAccess' && !review && draft && <>
            <section className="admin-editor-section"><h3>角色与单独授权</h3><p>更换角色时会保留单独设置。选「继承角色」可恢复该项默认权限。</p>{roleInput}</section>
            <section className="admin-editor-section admin-permission-editor">
              <h3>单独授权</h3>
              <p>{original.status === 'disabled' ? '每项右侧显示账号启用后的权限。' : '每项右侧显示新的生效结果。'}加入和编辑样本还需要查看样本权限。</p>
              {BUSINESS_PERMISSIONS.map(({ id, label, description }) => {
                const configured = overrides[id] ? overrides[id] === 'allow' : roleAllows(draft.role, id)
                const waitsForView = configured && (id === 'addSamples' || id === 'editSamples') && !canDo(draft, 'viewSamples')
                return <div className="admin-permission-row" key={id}>
                  <div><strong>{label}</strong><small>{description}</small></div>
                  <select className="field-select" aria-label={`${label}授权`} value={overrides[id] ?? 'inherit'} onChange={(event) => {
                    const value = event.target.value as keyof typeof overrideLabels
                    setError('')
                    setOverrides((previousOverrides) => {
                      const next = { ...previousOverrides }
                      if (value === 'inherit') delete next[id]
                      else next[id] = value
                      return next
                    })
                  }}>
                    {Object.entries(overrideLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                  {waitsForView ? <span className="admin-permission-indicator">需样本查看</span> : <PermissionIndicator allowed={canDo(draft, id)} />}
                </div>
              })}
            </section>
          </>}
          {action === 'updateAccess' && review && draft && <>
            <section className="admin-editor-section">
              <h3 ref={reviewHeading} tabIndex={-1}>变更摘要</h3>
              <p>保存后，当前会话和同一浏览器中的其他标签页会更新权限。</p>
              <ul className="admin-change-list">
                {roleChanged && <li><strong>角色</strong><span>{ROLE_LABELS[original.role]} <ArrowRight size={13} aria-hidden="true" /> {ROLE_LABELS[draft.role]}</span></li>}
                {changed.map(({ id, label }) => {
                  const previousAccess = canDo(previous, id)
                  const nextAccess = canDo(draft, id)
                  return <li key={id}><strong>{label}</strong><span>
                    {original.overrides[id] !== overrides[id] && <>{overrideLabels[original.overrides[id] ?? 'inherit']} <ArrowRight size={13} aria-hidden="true" /> {overrideLabels[overrides[id] ?? 'inherit']} · </>}
                    {previousAccess !== nextAccess && <>{previousAccess ? '已允许' : '未授权'} <ArrowRight size={13} aria-hidden="true" /> </>}{nextAccess ? '已允许' : '未授权'}
                  </span></li>
                })}
              </ul>
            </section>
            <section className="admin-editor-section"><h3>{original.status === 'disabled' ? '账号启用后的业务权限' : '保存后的业务权限'}</h3><PermissionList account={draft} /></section>
          </>}
          {isAccountTransition(action) && <section className="admin-editor-section">
            <h3 ref={reviewHeading} tabIndex={-1}>确认{accountTransitions[action].title}</h3>
            <p>{accountTransitions[action].description}</p>
            <div className="admin-transition"><AccountBadge status={accountTransitions[action].previous} /><ArrowRight size={16} aria-hidden="true" /><AccountBadge status={accountTransitions[action].next} /></div>
          </section>}
          {error && <p className="admin-feedback admin-feedback--error" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="admin-drawer-footer">
        <button className="button" type="button" onClick={() => {
          if (review && !stale) { setReview(false); setError('') }
          else if (action !== initialAction && !stale) { setAction(initialAction); setError('') }
          else onClose()
        }}>{review && !stale ? <><ArrowLeft size={15} aria-hidden="true" />返回编辑</> : action !== initialAction && !stale ? '返回申请' : '取消'}</button>
        {!stale && action === 'approve' && <>
          <button className="button admin-danger" type="button" onClick={() => { setError(''); setAction('reject') }}>拒绝申请</button>
          <button className="button button--primary button--sheen" type="button" disabled={!role} onClick={() => { if (role) commit({ type: 'approve', role }) }}>确认批准</button>
        </>}
        {!stale && action === 'updateAccess' && (!review
          ? <button className="button button--primary" type="button" disabled={!roleChanged && changed.length === 0} onClick={() => setReview(true)}>核对变更 <ChevronRight size={15} aria-hidden="true" /></button>
          : <button className="button button--primary button--sheen" type="button" onClick={() => { if (role) commit({ type: 'updateAccess', role, overrides }) }}>保存权限</button>)}
        {!stale && isAccountTransition(action) && <button className={`button ${action === 'disable' || action === 'reject' ? 'admin-danger-confirm' : 'button--primary'}`} type="button" onClick={() => commit({ type: action })}>确认{accountTransitions[action].title}</button>}
      </footer>
    </div>
  </dialog>
}

const feedbackLabels: Record<AccountAction, string> = { approve: '已批准申请', reject: '已拒绝申请', reopen: '已退回待审批', disable: '已停用账号', enable: '已启用账号', updateAccess: '已保存权限' }

export function AdminPage() {
  const { accounts, logs, currentUser, updateAccount } = useAuth()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [task, setTask] = useState<{ account: Account; action: AccountAction } | null>(null)
  const [feedback, setFeedback] = useState('')
  const pending = accounts.filter(({ status }) => status === 'pending').length
  const active = accounts.filter(({ status }) => status === 'active').length
  const ordered = [...accounts].sort((a, b) => statuses.indexOf(a.status) - statuses.indexOf(b.status) || a.id.localeCompare(b.id))
  const filtered = ordered.filter(({ id, status }) => (filter === 'all' || status === filter) && id.includes(search.trim().toLowerCase()))
  const newestLogs = [...logs].sort((a, b) => b.at.localeCompare(a.at))
  const open = (account: Account, action: AccountAction) => { setFeedback(''); setTask({ account, action }) }

  return <div className="page-stack admin-page">
    <PageHeader title="管理员中心" description="处理注册申请，分配账号权限，追溯权限与状态变更。" actions={<Badge tone="blue" dot>本地权限演示</Badge>} />
    <div className="admin-metrics" aria-label="账户概览">
      <MetricCard label="账户总数" value={accounts.length} caption="当前浏览器中的演示账号" icon={UsersRound} />
      <MetricCard label="待审批" value={pending} caption={pending ? '等待分配角色' : '没有待处理申请'} icon={Clock3} tone={pending ? 'amber' : 'slate'} />
      <MetricCard label="已启用" value={active} caption="可按已有权限登录后台" icon={CheckCircle2} tone="green" />
    </div>
    <Panel title="账户与注册审批" subtitle="批准申请时需选择普通角色。唯一的超级管理员账号受保护。" icon={UsersRound} action={<Badge tone={pending ? 'amber' : 'slate'}>{pending} 个待审批</Badge>}>
      <div className="admin-filters">
        <SearchInput label="搜索账号" value={search} onChange={setSearch} />
        <select className="field-select" aria-label="筛选账号状态" value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)}>
          <option value="all">所有状态</option>
          {statuses.map((status) => <option key={status} value={status}>{ACCOUNT_STATUS_LABELS[status]}</option>)}
        </select>
        <span>显示 {filtered.length} / {accounts.length} 个账号</span>
      </div>
      {feedback && <p className="admin-feedback" role="status"><CheckCircle2 size={16} aria-hidden="true" />{feedback}</p>}
      {filtered.length ? <Table label="账号列表" headings={['账号', '角色', '状态', '创建时间', '操作']}>
        {filtered.map((account) => {
          const protectedAccount = account.id === DEMO_ADMIN_ID
          const overrideCount = Object.keys(account.overrides).length
          return <tr key={account.id}>
            <th scope="row"><div className="admin-account">
              <span className={`tone-icon ${protectedAccount ? 'tone-blue' : 'tone-slate'}`} aria-hidden="true">{protectedAccount ? <ShieldCheck size={16} /> : <UserRound size={16} />}</span>
              <div><strong className="mono">{account.id}</strong>{account.id === currentUser?.id && <small>当前登录</small>}</div>
            </div></th>
            <td>{account.status === 'pending' || account.status === 'rejected' ? <span className="muted">未分配</span> : <div className="admin-account-role"><strong>{ROLE_LABELS[account.role]}</strong>{overrideCount > 0 && <small>{overrideCount} 项单独设置</small>}</div>}</td>
            <td><AccountBadge status={account.status} /></td>
            <td><DateCell value={account.createdAt} /></td>
            <td>{protectedAccount ? <span className="admin-protected"><LockKeyhole size={14} aria-hidden="true" />不可停用或降级</span> : <div className="admin-row-actions">
              {account.status === 'pending' && <button className="button button--primary" type="button" onClick={() => open(account, 'approve')}>处理申请 <ChevronRight size={14} aria-hidden="true" /></button>}
              {account.status === 'rejected' && <button className="button" type="button" onClick={() => open(account, 'reopen')}>退回待审批</button>}
              {(account.status === 'active' || account.status === 'disabled') && <>
                <button className="button" type="button" onClick={() => open(account, 'updateAccess')}>编辑权限</button>
                <button className="button button--quiet" type="button" onClick={() => open(account, account.status === 'active' ? 'disable' : 'enable')}>{account.status === 'active' ? '停用' : '启用'}</button>
              </>}
            </div>}</td>
          </tr>
        })}
      </Table> : <EmptyState title="没有符合条件的账号" description="试试其他账号名称或状态。" action={<button className="button" type="button" onClick={() => { setSearch(''); setFilter('all') }}>清除筛选</button>} />}
    </Panel>
    <RolesPanel />
    <Panel title="管理员操作日志" subtitle="操作记录仅保留在当前浏览器，按最新时间排列。" icon={FileText}>
      {newestLogs.length ? <Table label="管理员操作日志" headings={['时间', '操作者', '目标账号', '操作', '变更摘要']}>
        {newestLogs.map((entry) => <tr key={entry.id}>
          <td><DateCell value={entry.at} precise /></td><td className="mono">{entry.actor}</td><td className="mono">{entry.target}</td><td className="admin-log-action">{entry.action}</td><td className="admin-log-summary">{entry.summary}</td>
        </tr>)}
      </Table> : <EmptyState title="暂无操作记录" description="审批、启停和权限变更会记录在这里。" icon={FileText} />}
    </Panel>
    {task && <AccountEditor original={task.account} latest={accounts.find(({ id }) => id === task.account.id)} initialAction={task.action} onClose={() => setTask(null)} onCommit={(id, command) => {
      updateAccount(id, command)
      setFeedback(`${feedbackLabels[command.type]}：${id}`)
      setTask(null)
    }} />}
  </div>
}

export default AdminPage
