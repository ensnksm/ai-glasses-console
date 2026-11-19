import { lazy } from 'react'
import { BrainCircuit, ChartNoAxesCombined, ClipboardCheck, Database, FileText, Glasses, LayoutDashboard, ListFilter, Settings, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import MonitorPage from '../../pages/Monitor'
import Devices from '../../pages/Devices'
import DeviceDetail from '../../pages/DeviceDetail'
import { ROUTE_PERMISSIONS } from '../../services/permissions'
import type { Permission } from '../../services/permissions'
import { EmptyState } from '../common/ui'
import { WorkspaceLink } from './workspaceContext'

const AnalyticsPage = lazy(() => import('../../pages/Modules').then(module => ({ default: module.AnalyticsPage })))
const EventsPage = lazy(() => import('../../pages/Modules').then(module => ({ default: module.EventsPage })))
const EventDetailPage = lazy(() => import('../../pages/Modules').then(module => ({ default: module.EventDetailPage })))
const SamplesPage = lazy(() => import('../../pages/Modules').then(module => ({ default: module.SamplesPage })))
const DatasetsPage = lazy(() => import('../../pages/Modules').then(module => ({ default: module.DatasetsPage })))
const ModelsPage = lazy(() => import('../../pages/Modules').then(module => ({ default: module.ModelsPage })))
const SettingsPage = lazy(() => import('../../pages/Modules').then(module => ({ default: module.SettingsPage })))
const AdminPage = lazy(() => import('../../pages/Admin'))

const modules = {
  '/': { name: '实时监控', icon: LayoutDashboard, Page: MonitorPage },
  '/devices': { name: '设备管理', icon: Glasses, Page: Devices },
  '/analytics': { name: 'AI 运行分析', icon: ChartNoAxesCombined, Page: AnalyticsPage },
  '/events': { name: 'AI 事件中心', icon: ListFilter, Page: EventsPage },
  '/samples': { name: '样本审核', icon: ClipboardCheck, Page: SamplesPage },
  '/datasets': { name: '数据集管理', icon: Database, Page: DatasetsPage },
  '/models': { name: '模型监控', icon: BrainCircuit, Page: ModelsPage },
  '/admin': { name: '管理员中心', icon: UsersRound, Page: AdminPage },
  '/settings': { name: '系统设置', icon: Settings, Page: SettingsPage },
} as const

type ModulePath = keyof typeof modules
export type WindowPage = ModulePath | 'device' | 'event' | 'missing'

export interface WindowRoute {
  id: string
  page: WindowPage
  pathname: string
  search: string
  hash: string
  title: string
  icon: LucideIcon
  navPath?: ModulePath
  entityId?: string
  permission?: Permission
}

export const EMPTY_WORKSPACE = '/workspace'
const pathBase = 'http://aig.invalid'
const sidebarGroups: { label: string; paths: ModulePath[] }[] = [
  { label: '工作台', paths: ['/', '/devices', '/analytics', '/events'] },
  { label: '数据与模型', paths: ['/samples', '/datasets', '/models'] },
  { label: '系统管理', paths: ['/admin', '/settings'] },
]

export function permissionForModule(path: string) {
  return Object.hasOwn(ROUTE_PERMISSIONS, path) ? ROUTE_PERMISSIONS[path as keyof typeof ROUTE_PERMISSIONS] : undefined
}

export const groups = sidebarGroups.map(({ label, paths }) => ({
  label, links: paths.map(to => ({ to, name: modules[to].name, icon: modules[to].icon, permission: permissionForModule(to) })),
}))

export function hrefForWindow(route: WindowRoute) {
  return route.pathname + route.search + route.hash
}

export function parseWindowRoute(href: string): WindowRoute | null {
  let url: URL
  let decoded: string
  try {
    url = new URL(href, pathBase)
    if (!href.startsWith('/') || url.origin !== pathBase || url.pathname.startsWith('//')) throw new Error()
    decoded = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/'
  } catch {
    return { id: 'missing', page: 'missing', pathname: '/not-found', search: '', hash: '', title: '页面不存在', icon: FileText }
  }
  const path = decoded.toLowerCase()
  if (path === EMPTY_WORKSPACE) return null
  const deviceMatch = /^\/devices\/([^/]+)$/i.exec(decoded)
  if (deviceMatch) {
    const id = deviceMatch[1].toUpperCase()
    return { id: `device:${id}`, page: 'device', pathname: `/devices/${encodeURIComponent(id)}`, search: url.search, hash: url.hash,
      title: `设备详情 · ${id}`, icon: Glasses, entityId: id, navPath: '/devices' }
  }
  const eventId = path === '/events' ? url.searchParams.get('event')?.trim().toUpperCase() : undefined
  if (eventId) {
    url.searchParams.set('event', eventId)
    return { id: `event:${eventId}`, page: 'event', pathname: '/events', search: url.search, hash: url.hash,
      title: `事件详情 · ${eventId}`, icon: FileText, entityId: eventId, navPath: '/events' }
  }
  if (Object.hasOwn(modules, path)) {
    const page = path as ModulePath
    const { name, icon } = modules[page]
    return { id: page, page, pathname: page, search: url.search, hash: url.hash, title: name, icon, navPath: page, permission: permissionForModule(page) }
  }
  return { id: 'missing', page: 'missing', pathname: url.pathname, search: url.search, hash: url.hash, title: '页面不存在', icon: FileText }
}

export function WindowPageContent({ route }: { route: WindowRoute }) {
  if (route.page === 'device') return <DeviceDetail deviceId={route.entityId ?? ''} />
  if (route.page === 'event') return <EventDetailPage eventId={route.entityId ?? ''} />
  if (route.page === 'missing') return <EmptyState title="页面不存在" description="请从主导航选择模块，或打开实时监控。" action={
    <WorkspaceLink className="button button--primary" to="/">打开实时监控</WorkspaceLink>
  } />
  const Page = modules[route.page].Page
  return <Page />
}
