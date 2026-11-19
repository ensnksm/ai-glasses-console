import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { LayoutGrid, ShieldAlert, X } from 'lucide-react'
import { useAuth } from '../../services/auth'
import Shell from '../layout/Shell'
import { WorkspaceDock, WorkspaceFrame } from './WorkspaceFrame'
import { canSnapZone, canSplitWorkspace, clampWindowRect, getWindowRect, initialWindowRect, isSnapZone, zonesOverlap } from './geometry'
import type { SnapSide, WindowMode, WindowRect, WorkBounds } from './geometry'
import { playDockGenie } from './dockGenie'
import { WindowContext, WorkspaceContext, WorkspaceLink } from './workspaceContext'
import { EMPTY_WORKSPACE, hrefForWindow, parseWindowRoute, WindowPageContent } from './workspaceRoutes'
import type { WindowRoute } from './workspaceRoutes'
import './workspace.css'
import './workspace-glass.css'

type Flight = 'in' | 'out'
type UnmaximizedMode = Exclude<WindowMode, 'maximized'>

interface OpenWindow {
  route: WindowRoute
  mode: WindowMode
  restoreMode: UnmaximizedMode
  floating: WindowRect
  order: number
  minimized: boolean
  flight: Flight | null
}

interface WorkspaceState {
  windows: OpenWindow[]
  activeId: string | null
}

function foremost(windows: OpenWindow[]) {
  return windows.reduce<OpenWindow | undefined>((top, item) =>
    !item.minimized && (!top || item.order > top.order) ? item : top, undefined)
}

function amend(state: WorkspaceState, id: string, update: (item: OpenWindow) => OpenWindow) {
  return { ...state, windows: state.windows.map(item => item.route.id === id ? update(item) : item) }
}

function WindowView({ item, active, visible, compact, bounds, onFocus, onSearch, onGeometry, onSnap, onPreview, onMaximize, onMinimize, onClose }: {
  item: OpenWindow
  active: boolean
  visible: boolean
  compact: boolean
  bounds: WorkBounds
  onFocus: () => void
  onSearch: (params: URLSearchParams) => void
  onGeometry: (rect: WindowRect) => void
  onSnap: (side: SnapSide) => void
  onPreview: (side: SnapSide | null) => void
  onMaximize: () => void
  onMinimize: () => void
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const mode = compact ? 'maximized' : item.mode
  return <WorkspaceFrame id={item.route.id} title={item.route.title} active={active} visible={visible}
    flight={item.flight} mode={mode} stackOrder={item.order} rect={getWindowRect(mode, item.floating, bounds)}
    floatingRect={item.floating} bounds={bounds} canSnap={!compact} scrollRef={scrollRef}
    onFocus={onFocus} onGeometry={onGeometry} onSnap={onSnap} onPreview={onPreview}
    onMaximize={onMaximize} onMinimize={onMinimize} onClose={onClose}>
    <WindowContext.Provider value={{ search: item.route.search, setSearch: onSearch, scrollRef, visible: visible && !item.flight }}>
      <Suspense fallback={<p role="status" className="workspace-loading muted">正在加载窗口…</p>}>
        <WindowPageContent route={item.route} />
      </Suspense>
    </WindowContext.Provider>
  </WorkspaceFrame>
}

const permissionMessage = '当前账号没有访问该页面的权限。'

export default function Workspace() {
  const { can } = useAuth()
  const location = useLocation()
  const movement = useNavigationType()
  const navigate = useNavigate()
  const currentHref = location.pathname + location.search + location.hash
  const stage = useRef<HTMLElement>(null)
  const [bounds, setBounds] = useState<WorkBounds>({ width: 0, height: 0 })
  const [state, setState] = useState<WorkspaceState>({ windows: [], activeId: null })
  const latest = useRef(state)
  const nextOrder = useRef(0)
  const [preview, setPreview] = useState<SnapSide | null>(null)
  const [notice, setNotice] = useState('')
  const running = useRef(new Map<string, { flight: Flight; cancel: () => void }>())
  const pendingHref = useRef<string | null>(null)
  const lastLocation = useRef<string | null>(null)
  const pendingFocus = useRef<string | null>(null)
  const compact = !canSplitWorkspace(bounds)

  const allowed = (route: WindowRoute) => !route.permission || can(route.permission)
  const windows = state.windows.filter(item => allowed(item.route))
  const active = windows.find(item => item.route.id === state.activeId && !item.minimized)
  const compactVisibleId = active?.route.id ?? foremost(windows)?.route.id
  const anyVisible = windows.some(item => !item.minimized && (!compact || compactVisibleId === item.route.id))

  function commit(next: WorkspaceState) {
    latest.current = next
    setState(next)
  }

  function writeAddress(href: string, replace: boolean) {
    if (pendingHref.current === href || (!pendingHref.current && href === currentHref)) return
    pendingHref.current = href
    void navigate(href, { replace, preventScrollReset: true })
  }

  function frameElement(id: string) {
    return stage.current?.querySelector<HTMLElement>(`[data-workspace-window="${CSS.escape(id)}"]`)
  }

  function dockElement(id: string) {
    return document.querySelector<HTMLElement>(`[data-workspace-dock-item="${CSS.escape(id)}"]`)
  }

  function focusFrame(id: string) {
    pendingFocus.current = id
    requestAnimationFrame(restoreFrameFocus)
  }

  function restoreFrameFocus() {
    const id = pendingFocus.current
    if (!id) return
    if (latest.current.activeId !== id) {
      pendingFocus.current = null
      return
    }
    const node = frameElement(id)
    if (!node || node.inert) return
    pendingFocus.current = null
    if (!node.contains(document.activeElement)) node.focus({ preventScroll: true })
  }

  // A motion can finish before React has committed removal of `inert`.
  useLayoutEffect(restoreFrameFocus)

  function promote(base: WorkspaceState, route: WindowRoute): WorkspaceState {
    const existing = base.windows.find(item => item.route.id === route.id)
    if (existing && !existing.minimized && base.activeId === route.id && hrefForWindow(existing.route) === hrefForWindow(route)) return base
    const raised = ++nextOrder.current
    if (existing) {
      return { ...amend(base, route.id, item => ({
        ...item, route, order: raised, minimized: false, flight: item.minimized ? 'out' : item.flight,
      })), activeId: route.id }
    }
    const measured = { width: stage.current?.clientWidth || bounds.width, height: stage.current?.clientHeight || bounds.height }
    return { windows: [...base.windows, {
      // Open every module full-size, like a page; floating and split views stay one click away.
      route, mode: 'maximized', restoreMode: 'floating',
      floating: initialWindowRect(measured, base.windows.length), order: raised, minimized: false, flight: 'out',
    }], activeId: route.id }
  }

  useLayoutEffect(() => {
    const canvas = stage.current
    if (!canvas) return
    function measure() {
      if (!canvas) return
      const next = { width: canvas.clientWidth, height: canvas.clientHeight }
      setBounds(previous => previous.width === next.width && previous.height === next.height ? previous : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const before = latest.current
    const permitted = before.windows.filter(item => allowed(item.route))
    const pruned = permitted.length < before.windows.length
    const base = pruned ? { windows: permitted, activeId: permitted.some(item => item.route.id === before.activeId) ? before.activeId : null } : before
    if (pruned) {
      commit(base)
      setNotice('权限已更新，已关闭无法继续访问的窗口。')
    }
    if (pendingHref.current && currentHref !== pendingHref.current && lastLocation.current === location.key && movement !== 'POP') return
    pendingHref.current = null
    lastLocation.current = location.key

    const route = parseWindowRoute(currentHref)
    if (!route) {
      // Browser Back may revisit a desktop URL after other windows have opened.
      if (base.activeId !== null) commit({ ...base, activeId: null })
      return
    }
    if (!allowed(route)) {
      const fallback = foremost(base.windows)?.route ?? parseWindowRoute('/')!
      commit(promote(base, fallback))
      setNotice(pruned ? '权限已更新，已关闭无法继续访问的窗口。' : permissionMessage)
      writeAddress(hrefForWindow(fallback), true)
      return
    }
    const next = promote(base, route)
    if (next !== base) {
      commit(next)
      if (movement === 'POP' && !next.windows.find(item => item.route.id === route.id)?.flight) focusFrame(route.id)
    }
  }, [currentHref, location.key, movement, can])

  function finishFlight(id: string, flight: Flight) {
    if (running.current.get(id)?.flight === flight) running.current.delete(id)
    if (!latest.current.windows.some(item => item.route.id === id && item.flight === flight)) return
    commit(amend(latest.current, id, item => ({ ...item, flight: null })))
    if (flight === 'out') focusFrame(id)
  }

  useLayoutEffect(() => {
    const flights = running.current
    for (const [id, travel] of flights) {
      if (!windows.some(item => item.route.id === id && item.flight === travel.flight)) {
        travel.cancel()
        flights.delete(id)
      }
    }
    if (!bounds.width || !bounds.height) return

    for (const item of windows) {
      const id = item.route.id
      const flight = item.flight
      if (!flight || flights.has(id)) continue
      const frame = frameElement(id)
      const dock = dockElement(id)
      if (!frame || !dock || (flight === 'out' && compact && state.activeId !== id)) {
        finishFlight(id, flight)
        continue
      }
      dock.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const from = frame.getBoundingClientRect()
      const to = dock.getBoundingClientRect()
      let finished = false
      const cancel = playDockGenie({
        source: flight === 'in' ? from : to,
        target: flight === 'in' ? to : from,
        direction: flight,
        frame,
        onFinish: () => { finished = true; finishFlight(id, flight) },
      })
      if (!finished) flights.set(id, { flight, cancel })
    }
  })

  useLayoutEffect(() => {
    function settle() {
      for (const [id, motion] of Array.from(running.current)) {
        motion.cancel()
        finishFlight(id, motion.flight)
      }
      setPreview(null)
    }
    window.addEventListener('resize', settle)
    const flights = running.current
    return () => {
      window.removeEventListener('resize', settle)
      for (const motion of flights.values()) motion.cancel()
      flights.clear()
    }
  }, [])

  function openWindow(to: string) {
    const route = parseWindowRoute(to)
    if (!route) return
    if (!allowed(route)) { setNotice(permissionMessage); return }
    setNotice('')
    const existing = latest.current.windows.find(item => item.route.id === route.id)
    const destination = existing && !route.search && !route.hash ? existing.route : route
    const next = promote(latest.current, destination)
    if (next !== latest.current) commit(next)
    writeAddress(hrefForWindow(destination), false)
    if (!next.windows.find(item => item.route.id === destination.id)?.flight) focusFrame(destination.id)
  }

  function focusWindow(id: string, fromDock = false) {
    const item = latest.current.windows.find(window => window.route.id === id)
    if (!item || !allowed(item.route) || (!fromDock && (item.minimized || item.flight))) return
    const next = promote(latest.current, item.route)
    if (next !== latest.current) commit(next)
    writeAddress(hrefForWindow(item.route), true)
    if (fromDock && !next.windows.find(window => window.route.id === id)?.flight) focusFrame(id)
  }

  function hideWindow(id: string, keep: boolean) {
    const previous = latest.current
    if (!previous.windows.some(item => item.route.id === id)) return
    const changed = keep ? amend(previous, id, item => ({ ...item, minimized: true, flight: 'in' })) :
      { ...previous, windows: previous.windows.filter(item => item.route.id !== id) }
    if (previous.activeId === id || previous.activeId === null) {
      const replacement = foremost(changed.windows)
      changed.activeId = replacement?.route.id ?? null
      writeAddress(replacement ? hrefForWindow(replacement.route) : EMPTY_WORKSPACE, true)
      if (!keep && replacement) focusFrame(replacement.route.id)
      if (!keep && !replacement) requestAnimationFrame(() => stage.current?.focus({ preventScroll: true }))
    }
    commit(changed)
    if (keep) requestAnimationFrame(() => {
      if (latest.current.windows.some(item => item.route.id === id && item.minimized)) dockElement(id)?.focus({ preventScroll: true })
    })
  }

  function changeSearch(id: string, params: URLSearchParams) {
    const before = latest.current
    const item = before.windows.find(window => window.route.id === id)
    if (!item || !allowed(item.route)) return
    const query = params.toString()
    const route = { ...item.route, search: query ? `?${query}` : '' }
    if (hrefForWindow(route) === hrefForWindow(item.route)) return
    commit(amend(before, id, window => ({ ...window, route })))
    if (before.activeId === id) writeAddress(hrefForWindow(route), true)
  }

  function snap(id: string, side: SnapSide) {
    if (compact || !canSnapZone(side, bounds)) return
    const base = latest.current
    // A window already holding any part of the target zone steps back to floating.
    commit({
      ...base,
      windows: base.windows.map(item => item.route.id === id
        ? { ...item, mode: side, restoreMode: side }
        : isSnapZone(item.mode) && zonesOverlap(item.mode, side) ? { ...item, mode: 'floating', restoreMode: 'floating' } : item),
    })
    setPreview(null)
  }

  const snapBounds = preview && !compact ? getWindowRect(preview, initialWindowRect(bounds, 0), bounds) : null
  return <WorkspaceContext.Provider value={{ openWindow }}>
    <Shell activeTo={active?.route.navPath} title={active?.route.title} dock={
      <WorkspaceDock items={windows.map(item => ({
        id: item.route.id, title: item.route.title, icon: item.route.icon,
        active: active === item, minimized: item.minimized,
      }))} onSelect={(id) => focusWindow(id, true)} />
    }>
      <main className="workspace-stage" id="main-content" ref={stage} tabIndex={-1} aria-label="窗口工作区">
        {!anyVisible && <div className="workspace-stage-message">
          <LayoutGrid size={25} aria-hidden="true" />
          <strong>{windows.length ? '窗口已收起' : '工作台'}</strong>
          <p>{windows.length ? '点击底部 Dock 恢复窗口，或从侧栏打开其他模块。' : '从左侧导航打开模块。你可以把窗口拖到左右边缘并排查看。'}</p>
          {!windows.length && <WorkspaceLink to="/" className="button">打开实时监控</WorkspaceLink>}
        </div>}
        {snapBounds && <div className="workspace-snap-preview" style={{ left: snapBounds.x, top: snapBounds.y, width: snapBounds.width, height: snapBounds.height }} aria-hidden="true" />}
        {windows.map(item => <WindowView key={item.route.id} item={item} active={active === item} visible={!item.minimized && (!compact || compactVisibleId === item.route.id)}
          compact={compact} bounds={bounds} onFocus={() => focusWindow(item.route.id)} onSearch={(params) => changeSearch(item.route.id, params)}
          onGeometry={(rect) => commit(amend(latest.current, item.route.id, value => ({ ...value, mode: 'floating', restoreMode: 'floating', floating: clampWindowRect(rect, bounds) })))}
          onSnap={(side) => snap(item.route.id, side)} onPreview={setPreview}
          onMaximize={() => {
            if (compact) return
            if (item.mode === 'maximized' && item.restoreMode !== 'floating') {
              snap(item.route.id, item.restoreMode)
              return
            }
            commit(amend(latest.current, item.route.id, value => value.mode === 'maximized'
              ? { ...value, mode: value.restoreMode }
              : { ...value, mode: 'maximized', restoreMode: value.mode }))
          }}
          onMinimize={() => hideWindow(item.route.id, true)} onClose={() => hideWindow(item.route.id, false)} />)}
        {notice && <div className="shell-access-notice workspace-notice" role="status">
          <ShieldAlert size={16} aria-hidden="true" />{notice}
          <button className="icon-button" type="button" aria-label="关闭提示" onClick={() => setNotice('')}><X size={14} aria-hidden="true" /></button>
        </div>}
      </main>
    </Shell>
  </WorkspaceContext.Provider>
}
