import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ACCOUNT_STATUS_LABELS, BUSINESS_PERMISSIONS, DEMO_ADMIN_ID, ORDINARY_ROLES, ROLE_LABELS, canDo } from './permissions'
import type { Account, OrdinaryRole, Permission, PermissionOverrides } from './permissions'
import { AUTH_STORE_KEY, createCredential, getSessionAccount, matchesCredential, normalizeUsername, readAuthStore, readSession, validPasswordLength, writeAuthStore, writeSession } from './authStorage'
import type { AuditLog, AuthStore, DemoSession, StoredAccount } from './authStorage'

export type { AuditLog } from './authStorage'
export type AccountCommand =
  | { type: 'approve'; role: OrdinaryRole }
  | { type: 'reject' | 'reopen' | 'disable' | 'enable' }
  | { type: 'updateAccess'; role: OrdinaryRole; overrides: PermissionOverrides }

interface AuthSnapshot {
  store: AuthStore | null
  session: DemoSession | null
  sessionNotice: string
}

interface AuthContextValue {
  currentUser: Account | null
  sessionNotice: string
  accounts: Account[]
  logs: AuditLog[]
  can: (permission: Permission) => boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<{ username: string }>
  logout: () => void
  updateAccount: (id: string, command: AccountCommand) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const lostSession = '当前账号已停用或登录状态已失效，请重新登录。'

function loadSnapshot(): AuthSnapshot {
  try {
    const store = readAuthStore()
    const session = readSession()
    return session && !getSessionAccount(store, session)
      ? { store, session: null, sessionNotice: lostSession }
      : { store, session, sessionNotice: '' }
  } catch (error) {
    return { store: null, session: null, sessionNotice: error instanceof Error ? error.message : lostSession }
  }
}

function publicAccount({ id, role, status, createdAt, overrides }: StoredAccount): Account {
  return { id, role, status, createdAt, overrides }
}

export function canNow(permission: Permission) {
  try { return canDo(getSessionAccount(readAuthStore(), readSession()), permission) } catch { return false }
}

function audit(actor: string, target: string, action: string, summary: string): AuditLog {
  return { id: window.crypto.randomUUID(), at: new Date().toISOString(), actor, target, action, summary }
}

const overrideLabels = { allow: '允许', deny: '禁止', inherit: '继承角色' } as const

function applyAccountCommand(account: StoredAccount, command: AccountCommand) {
  const previous = account.status
  const role = ROLE_LABELS[account.role]
  const invalidStatus = () => { throw new Error('账号状态已变化，请关闭窗口后重新操作。') }
  if ((command.type === 'approve' || command.type === 'updateAccess') && !ORDINARY_ROLES.includes(command.role)) {
    throw new Error('请选择一个普通账号角色。')
  }
  switch (command.type) {
    case 'approve':
      if (previous !== 'pending') return invalidStatus()
      return { account: { ...account, status: 'active', role: command.role }, action: '批准注册', summary: `待审批 → 已启用；未分配角色 → ${ROLE_LABELS[command.role]}` } as const
    case 'reject':
      if (previous !== 'pending') return invalidStatus()
      return { account: { ...account, status: 'rejected' }, action: '拒绝注册', summary: '待审批 → 已拒绝' } as const
    case 'reopen':
      if (previous !== 'rejected') return invalidStatus()
      return { account: { ...account, status: 'pending' }, action: '退回待审批', summary: '已拒绝 → 待审批' } as const
    case 'disable':
      if (previous !== 'active') return invalidStatus()
      return { account: { ...account, status: 'disabled', sessionVersion: account.sessionVersion + 1 }, action: '停用账号', summary: '已启用 → 已停用' } as const
    case 'enable':
      if (previous !== 'disabled') return invalidStatus()
      return { account: { ...account, status: 'active' }, action: '启用账号', summary: '已停用 → 已启用' } as const
    case 'updateAccess': {
      if (previous !== 'active' && previous !== 'disabled') return invalidStatus()
      const overrides: PermissionOverrides = {}
      const changes = command.role === account.role ? [] : [`角色：${role} → ${ROLE_LABELS[command.role]}`]
      for (const { id, label } of BUSINESS_PERMISSIONS) {
        const before = account.overrides[id]
        const after = command.overrides[id]
        if (after !== undefined && after !== 'allow' && after !== 'deny') throw new Error('授权选项无效。')
        if (after) overrides[id] = after
        if (before !== after) changes.push(`${label}：${overrideLabels[before ?? 'inherit']} → ${overrideLabels[after ?? 'inherit']}`)
      }
      return changes.length ? { account: { ...account, role: command.role, overrides }, action: '调整权限', summary: changes.join('；') } : null
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(loadSnapshot)
  const signedIn = getSessionAccount(snapshot.store, snapshot.session)
  const currentUser = signedIn ? publicAccount(signedIn) : null

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== AUTH_STORE_KEY && event.key !== null) return
      setSnapshot(loadSnapshot())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  async function login(username: string, password: string) {
    const id = normalizeUsername(username)
    const candidate = readAuthStore().accounts.find(account => account.id === id)
    if (!candidate || !await matchesCredential(password, candidate.credential)) {
      throw new Error('用户名或演示口令不正确。')
    }
    // Approval or a credential change may have arrived while the browser was verifying the password.
    const store = readAuthStore()
    const account = store.accounts.find(item => item.id === id && item.credential.salt === candidate.credential.salt && item.credential.verifier === candidate.credential.verifier)
    if (!account) throw new Error('账号状态已变化，请重新登录。')
    if (account.status !== 'active') {
      const message = {
        pending: '账号待超级管理员审批，批准后才能登录。',
        rejected: '注册申请已被拒绝，请联系超级管理员。',
        disabled: '账号已停用，请联系超级管理员。',
      } satisfies Record<Exclude<Account['status'], 'active'>, string>
      throw new Error(message[account.status])
    }
    const session = { accountId: account.id, version: account.sessionVersion }
    writeSession(session)
    setSnapshot({ store, session, sessionNotice: '' })
  }

  async function register(username: string, password: string) {
    const id = normalizeUsername(username)
    if (!id) throw new Error('用户名须为 3–24 位英文字母、数字、下划线或连字符。')
    if (!validPasswordLength(password)) throw new Error('演示口令长度须为 8–64 个字符。')
    if (readAuthStore().accounts.some(account => account.id === id)) throw new Error('该用户名已被使用，请更换用户名或返回登录。')
    const credential = await createCredential(password)
    const store = readAuthStore()
    if (store.accounts.some(account => account.id === id)) throw new Error('该用户名已被使用，请更换用户名或返回登录。')
    const account: StoredAccount = { id, role: 'viewer', status: 'pending', overrides: {}, createdAt: new Date().toISOString(), credential, sessionVersion: 0 }
    const next: AuthStore = { ...store, accounts: [...store.accounts, account], logs: [audit(id, id, '提交注册申请', '新账号 → 待审批'), ...store.logs] }
    writeAuthStore(next)
    setSnapshot({ store: next, session: readSession(), sessionNotice: '' })
    return { username: id }
  }

  function logout() {
    writeSession(null)
    setSnapshot((previous) => ({ ...previous, session: null, sessionNotice: '' }))
  }

  function updateAccount(id: string, command: AccountCommand) {
    const store = readAuthStore()
    const session = readSession()
    const operator = getSessionAccount(store, session)
    if (!operator || !canDo(operator, 'manageAccounts')) throw new Error('当前账号没有管理权限。')
    if (id === DEMO_ADMIN_ID) throw new Error('内置超级管理员不可停用或调整权限。')
    const target = store.accounts.find(account => account.id === id)
    if (!target) throw new Error('未找到这个账号。')
    const change = applyAccountCommand(target, command)
    if (!change) return
    const next: AuthStore = {
      ...store,
      accounts: store.accounts.map(account => account.id === id ? change.account : account),
      logs: [audit(operator.id, id, change.action, change.summary), ...store.logs],
    }
    writeAuthStore(next)
    setSnapshot({ store: next, session, sessionNotice: '' })
  }

  return <AuthContext.Provider value={{
    currentUser,
    sessionNotice: snapshot.sessionNotice,
    accounts: currentUser?.id === DEMO_ADMIN_ID ? snapshot.store?.accounts.map(publicAccount) ?? [] : [],
    logs: currentUser?.id === DEMO_ADMIN_ID ? snapshot.store?.logs ?? [] : [],
    can: permission => canDo(currentUser, permission),
    login,
    register,
    logout,
    updateAccount,
  }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is missing')
  return value
}
