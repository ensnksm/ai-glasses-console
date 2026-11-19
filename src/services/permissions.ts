export const DEMO_ADMIN_ID = 'admin01'
export const demoPasswordFor = (id: string) => `AigDemo-${id}`

export const ROLE_LABELS = { superadmin: '超级管理员', analyst: 'AI 分析师', reviewer: '数据审核员', viewer: '只读观察员' } as const
export const ACCOUNT_STATUS_LABELS = { pending: '待审批', active: '已启用', rejected: '已拒绝', disabled: '已停用' } as const
export const ORDINARY_ROLES = ['analyst', 'reviewer', 'viewer'] as const
export type Role = keyof typeof ROLE_LABELS
export type OrdinaryRole = typeof ORDINARY_ROLES[number]
export type AccountStatus = keyof typeof ACCOUNT_STATUS_LABELS

export const BUSINESS_PERMISSIONS = [
  { id: 'viewAnalytics', label: '查看运行分析', description: '查看 AI 业务指标与调用趋势。' },
  { id: 'viewModels', label: '查看模型监控', description: '查看模型版本、探测状态与异常。' },
  { id: 'viewDatasets', label: '查看数据集', description: '查看数据集和样本统计，不包含编辑或导出。' },
  { id: 'viewSamples', label: '查看候选样本', description: '打开样本审核工作台和来源记录。' },
  { id: 'reviewResults', label: '审核识别结果', description: '修改事件与候选样本共用的识别结论。' },
  { id: 'addSamples', label: '加入候选样本', description: '将事件加入候选样本库，需要查看候选样本权限。' },
  { id: 'editSamples', label: '编辑候选样本', description: '修改样本文字、标签及收录资格，需要查看候选样本权限。' },
] as const

export type BusinessPermission = typeof BUSINESS_PERMISSIONS[number]['id']
export type Permission = BusinessPermission | 'manageAccounts' | 'manageSimulation'
export type PermissionOverrides = Partial<Record<BusinessPermission, 'allow' | 'deny'>>

export interface Account {
  id: string
  role: Role
  status: AccountStatus
  overrides: PermissionOverrides
  createdAt: string
}

const rolePermissions: Record<OrdinaryRole, ReadonlySet<Permission>> = {
  analyst: new Set(['viewAnalytics', 'viewModels', 'viewDatasets']),
  reviewer: new Set(['viewSamples', 'reviewResults', 'addSamples', 'editSamples']),
  viewer: new Set(),
}

export function roleAllows(role: Role, permission: Permission) {
  return role === 'superadmin' || rolePermissions[role].has(permission)
}

export function canDo(account: Account | null, permission: Permission): boolean {
  if (account?.status !== 'active') return false
  if (account.role === 'superadmin') return account.id === DEMO_ADMIN_ID
  if (permission === 'manageAccounts' || permission === 'manageSimulation') return false
  const override = account.overrides[permission]
  const allowed = override ? override === 'allow' : roleAllows(account.role, permission)
  if (!allowed) return false
  return permission === 'addSamples' || permission === 'editSamples' ? canDo(account, 'viewSamples') : true
}

export const ROUTE_PERMISSIONS = {
  '/analytics': 'viewAnalytics',
  '/samples': 'viewSamples',
  '/datasets': 'viewDatasets',
  '/models': 'viewModels',
  '/admin': 'manageAccounts',
} as const satisfies Record<string, Permission>

export function resolveLoginDestination(account: Account, requested: unknown) {
  if (typeof requested !== 'string' || !requested.startsWith('/')) return '/'
  const base = 'http://aig.invalid'
  try {
    const url = new URL(requested, base)
    if (url.origin !== base || url.pathname.startsWith('//')) return '/'
    const path = decodeURIComponent(url.pathname).toLowerCase().replace(/\/+$/, '') || '/'
    if (Object.hasOwn(ROUTE_PERMISSIONS, path)) {
      if (!canDo(account, ROUTE_PERMISSIONS[path as keyof typeof ROUTE_PERMISSIONS])) return '/'
    } else if (!['/', '/devices', '/events', '/settings', '/workspace'].includes(path) && !/^\/devices\/[^/]+$/.test(path)) {
      return '/'
    }
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}
