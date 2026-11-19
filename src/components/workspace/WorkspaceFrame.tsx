import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent, ReactNode, RefObject } from 'react'
import { Columns2, LayoutGrid, Maximize2, Minimize2, Minus, SlidersHorizontal, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { canSnapZone, clampWindowRect, getResizeRect, getWindowScaleLimits, resizeEdges, scaleWindowRect, snapZones } from './geometry'
import type { ResizeEdge, SnapSide, WindowMode, WindowRect, WorkBounds } from './geometry'
import './workspace.css'
import './workspace-resize.css'
import { useGlassSelection } from '../../hooks/useGlassSelection'
import { useLiquidGlass } from '../../hooks/useLiquidGlass'
import './workspace-dock-selection.css'

type FrameProps = {
  id: string
  title: string
  active: boolean
  visible: boolean
  flight: 'in' | 'out' | null
  mode: WindowMode
  rect: WindowRect
  floatingRect: WindowRect
  bounds: WorkBounds
  canSnap: boolean
  stackOrder?: number
  scrollRef: RefObject<HTMLDivElement | null>
  onFocus: () => void
  onGeometry: (next: WindowRect) => void
  onSnap: (side: SnapSide) => void
  onPreview: (side: SnapSide | null) => void
  onMaximize: () => void
  onMinimize: () => void
  onClose: () => void
  children: ReactNode
}

type GestureIntent = { kind: 'move' } | { kind: 'resize'; edge: ResizeEdge }
type Gesture = GestureIntent & {
  pointerId: number
  capture: HTMLElement
  initial: WindowRect
  clientX: number
  clientY: number
  stageX: number
  stageY: number
  start: WindowRect
  moved: boolean
  draft: WindowRect | null
  preview: SnapSide | null
  frame: number | null
}

type ScaleGesture = {
  input: HTMLInputElement
  reference: WindowRect
  initial: number
  percent: number
  frame: number | null
  cleanup?: () => void
  keys?: Set<string>
}

const dragThreshold = 5
const snapDistance = 28
// Within this distance of a corner, an edge drop snaps to a quarter instead of a half.
const cornerReach = 90
const scaleKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

function WindowControl({ icon: Icon, label, onClick, close = false }: {
  icon: LucideIcon
  label: string
  onClick: () => void
  close?: boolean
}) {
  return <button className={`workspace-window-control${close ? ' workspace-window-control--close' : ''}`} type="button" title={label} aria-label={label} onClick={onClick}>
    <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
  </button>
}

/** Which snap zone a dragged window's pointer is over: edges give halves, corners give quarters. */
function snapZoneAt(x: number, y: number, bounds: WorkBounds): SnapSide | null {
  const nearLeft = x <= snapDistance
  const nearRight = x >= bounds.width - snapDistance
  const nearTop = y <= snapDistance
  const nearBottom = y >= bounds.height - snapDistance
  const horizontal = x <= cornerReach ? 'left' : x >= bounds.width - cornerReach ? 'right' : null
  const vertical = y <= cornerReach ? 'top' : y >= bounds.height - cornerReach ? 'bottom' : null
  let zone: SnapSide | null = null
  if ((nearLeft || nearRight) && vertical) zone = `${vertical}-${nearLeft ? 'left' : 'right'}`
  else if ((nearTop || nearBottom) && horizontal) zone = `${nearTop ? 'top' : 'bottom'}-${horizontal}`
  else if (nearLeft) zone = 'left'
  else if (nearRight) zone = 'right'
  else if (nearTop) zone = 'top'
  else if (nearBottom) zone = 'bottom'
  return zone && canSnapZone(zone, bounds) ? zone : null
}

/** Title-bar layout menu: a small map of the workspace to place this window in a half or a quarter. */
function SnapLayoutPicker({ mode, bounds, onPick }: { mode: WindowMode; bounds: WorkBounds; onPick: (zone: SnapSide) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  useEffect(() => {
    if (!open) return
    const dismiss = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', dismiss, true)
    return () => window.removeEventListener('pointerdown', dismiss, true)
  }, [open])
  return <div className="workspace-snap-picker" ref={root} onKeyDown={(event) => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    toggle.current?.focus({ preventScroll: true })
  }}>
    <button ref={toggle} className="workspace-window-control" type="button" title="窗口布局" aria-label="窗口布局"
      aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <LayoutGrid size={15} strokeWidth={1.8} aria-hidden="true" />
    </button>
    {open && <div className="workspace-snap-panel" id={panelId} role="group" aria-label="选择窗口布局">
      {snapZones.map(({ zone, label }) => {
        const available = canSnapZone(zone, bounds)
        return <button key={zone} type="button" className="workspace-snap-option" data-zone={zone} aria-pressed={mode === zone}
          disabled={!available} aria-label={label} title={available ? label : `${label}（工作区空间不足）`}
          onClick={() => { setOpen(false); onPick(zone) }}>
          <span aria-hidden="true" />
        </button>
      })}
    </div>}
  </div>
}

/** Window buttons: quiet icons that pick up colour on hover (close turns red). */
function WindowButton({ kind, icon: Icon, label, onClick }: { kind: 'close' | 'minimize' | 'zoom'; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button className={`window-button window-button--${kind}`} type="button" title={label} aria-label={label} onClick={onClick}>
    <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
  </button>
}

export function WorkspaceFrame({
  id, title, active, visible, flight, mode, rect, floatingRect, bounds, canSnap, stackOrder,
  scrollRef, onFocus, onGeometry, onSnap, onPreview, onMaximize, onMinimize, onClose, children,
}: FrameProps) {
  const frameRef = useRef<HTMLElement | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const titleId = useId()
  const scaleId = useId()
  const scaleToggle = useRef<HTMLButtonElement>(null)
  const scaleInput = useRef<HTMLInputElement>(null)
  const scaleGesture = useRef<ScaleGesture | null>(null)
  const [draft, setDraft] = useState<WindowRect | null>(null)
  const [scaleDraft, setScaleDraft] = useState<WindowRect | null>(null)
  const [scaleActive, setScaleActive] = useState(false)
  const [scaling, setScaling] = useState<{ reference: WindowRect; percent: number } | null>(null)
  const current = scaleDraft ?? draft ?? rect
  const interactive = visible && !flight
  const isMaximized = mode === 'maximized'
  const scaleLimits = getWindowScaleLimits(scaling?.reference ?? rect, bounds)
  const scaleOpen = scaling !== null

  function clearGesture() {
    const currentGesture = gesture.current
    if (!currentGesture) return
    gesture.current = null
    if (currentGesture.frame !== null) cancelAnimationFrame(currentGesture.frame)
    if (currentGesture.capture.hasPointerCapture(currentGesture.pointerId)) currentGesture.capture.releasePointerCapture(currentGesture.pointerId)
    if (currentGesture.preview) onPreview(null)
    setDraft(null)
  }

  function disposeScaleGesture() {
    const currentGesture = scaleGesture.current
    if (!currentGesture) return null
    scaleGesture.current = null
    if (currentGesture.frame !== null) cancelAnimationFrame(currentGesture.frame)
    currentGesture.cleanup?.()
    return currentGesture
  }

  function finishScale(commit: boolean) {
    const currentGesture = disposeScaleGesture()
    if (!currentGesture) return
    const percent = commit ? currentGesture.input.valueAsNumber : currentGesture.initial
    if (!commit) currentGesture.input.valueAsNumber = percent
    setScaling((previous) => previous && { ...previous, percent })
    setScaleDraft(null)
    setScaleActive(false)
    if (commit && percent !== currentGesture.initial) onGeometry(scaleWindowRect(currentGesture.reference, percent))
  }

  function closeScale() {
    finishScale(false)
    setScaling(null)
  }

  function beginScale(input: HTMLInputElement) {
    if (!scaling || scaleGesture.current) return null
    const currentGesture: ScaleGesture = { input, reference: scaling.reference, initial: input.valueAsNumber, percent: input.valueAsNumber, frame: null }
    scaleGesture.current = currentGesture
    setScaleActive(true)
    return currentGesture
  }

  function startPointerScale(event: PointerEvent<HTMLInputElement>) {
    if (!event.isPrimary || event.button !== 0) return
    const currentGesture = beginScale(event.currentTarget)
    if (!currentGesture) return
    const id = event.pointerId
    const release = (end: globalThis.PointerEvent) => { if (end.pointerId === id) finishScale(true) }
    const cancel = (end: globalThis.PointerEvent) => { if (end.pointerId === id) finishScale(false) }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', cancel)
    currentGesture.cleanup = () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', cancel)
    }
  }

  function changeScale(percent: number) {
    if (!scaling) return
    const currentGesture = scaleGesture.current
    if (!currentGesture) {
      if (percent !== scaling.percent) {
        setScaling({ ...scaling, percent })
        onGeometry(scaleWindowRect(scaling.reference, percent))
      }
      return
    }
    // Keep the native thumb responsive without updating sibling windows during each input event.
    currentGesture.percent = percent
    if (currentGesture.frame !== null) return
    currentGesture.frame = requestAnimationFrame(() => {
      currentGesture.frame = null
      const { initial, percent, reference } = currentGesture
      setScaling((previous) => previous && { ...previous, percent })
      setScaleDraft(percent === initial ? null : scaleWindowRect(reference, percent))
    })
  }

  const previewHandler = useRef(onPreview)
  useEffect(() => { previewHandler.current = onPreview }, [onPreview])
  useEffect(() => {
    function onBlur() { clearGesture(); finishScale(false) }
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      const currentGesture = gesture.current
      gesture.current = null
      if (currentGesture?.frame != null) cancelAnimationFrame(currentGesture.frame)
      if (currentGesture?.preview) previewHandler.current(null)
      disposeScaleGesture()
    }
  }, [])
  useEffect(() => {
    if (!interactive || !canSnap) {
      clearGesture()
      closeScale()
    }
  }, [interactive, canSnap])
  useEffect(closeScale, [bounds.width, bounds.height])
  useEffect(() => { if (mode !== 'floating') closeScale() }, [mode])
  useEffect(() => { if (scaleOpen) scaleInput.current?.focus({ preventScroll: true }) }, [scaleOpen])

  function startGesture(event: PointerEvent<HTMLElement>, intent: GestureIntent) {
    if (!interactive || !canSnap || event.button !== 0 || !event.isPrimary || gesture.current) return
    if (intent.kind === 'move' && event.target instanceof Element && event.target.closest('button, a, input, select, textarea, .workspace-window-scale, .workspace-snap-picker')) return
    const frame = frameRef.current
    if (!frame) return
    const screenRect = frame.getBoundingClientRect()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    closeScale()
    gesture.current = {
      ...intent,
      pointerId: event.pointerId,
      capture: event.currentTarget,
      initial: { ...rect },
      clientX: event.clientX,
      clientY: event.clientY,
      stageX: screenRect.left - rect.x,
      stageY: screenRect.top - rect.y,
      start: intent.kind === 'resize' || mode === 'floating' ? rect : clampWindowRect(floatingRect, bounds),
      moved: false,
      draft: null,
      preview: null,
      frame: null,
    }
    frame.focus({ preventScroll: true })
  }

  function updateGesture(event: PointerEvent<HTMLElement>, currentGesture: Gesture, paint: boolean) {
    const deltaX = event.clientX - currentGesture.clientX
    const deltaY = event.clientY - currentGesture.clientY
    if (!currentGesture.moved && Math.hypot(deltaX, deltaY) < dragThreshold) return
    currentGesture.moved = true
    if (currentGesture.kind === 'resize') {
      const next = getResizeRect(currentGesture.start, deltaX, deltaY, bounds, currentGesture.edge)
      const start = currentGesture.start
      currentGesture.draft = next.x === start.x && next.y === start.y && next.width === start.width && next.height === start.height ? null : next
    } else {
      const isRestoring = mode !== 'floating'
      const anchor = Math.max(0, Math.min(1, (currentGesture.clientX - currentGesture.stageX - currentGesture.initial.x) / Math.max(1, currentGesture.initial.width)))
      currentGesture.draft = clampWindowRect({
        ...currentGesture.start,
        x: currentGesture.initial.x + deltaX + (isRestoring ? (currentGesture.initial.width - currentGesture.start.width) * anchor : 0),
        y: currentGesture.initial.y + deltaY,
      }, bounds)
      const side = snapZoneAt(event.clientX - currentGesture.stageX, event.clientY - currentGesture.stageY, bounds)
      if (side !== currentGesture.preview) {
        currentGesture.preview = side
        onPreview(side)
      }
    }
    if (paint && currentGesture.frame === null) {
      currentGesture.frame = requestAnimationFrame(() => {
        currentGesture.frame = null
        if (gesture.current === currentGesture) setDraft(currentGesture.draft)
      })
    }
  }

  function moveGesture(event: PointerEvent<HTMLElement>) {
    const currentGesture = gesture.current
    if (currentGesture?.pointerId === event.pointerId) updateGesture(event, currentGesture, true)
  }

  function finishGesture(event: PointerEvent<HTMLElement>) {
    const currentGesture = gesture.current
    if (currentGesture?.pointerId !== event.pointerId) return
    updateGesture(event, currentGesture, false)
    const next = currentGesture.draft
    const side = currentGesture.preview
    clearGesture()
    if (side) onSnap(side)
    else if (next) onGeometry(next)
  }

  function cancelGesture(event: PointerEvent<HTMLElement>) {
    if (gesture.current?.pointerId === event.pointerId) clearGesture()
  }

  const gestureHandlers = {
    onPointerMove: moveGesture, onPointerUp: finishGesture, onPointerCancel: cancelGesture, onLostPointerCapture: cancelGesture,
  }

  return (
    <section ref={frameRef} tabIndex={-1} role="region" aria-labelledby={titleId}
      className="workspace-frame" data-workspace-window={id} data-active={active ? '' : undefined}
      data-mode={draft || scaleDraft ? 'floating' : mode} data-gesturing={draft ? '' : undefined}
      data-scaling={scaleActive ? '' : undefined}
      data-resizable={canSnap ? '' : undefined}
      data-unfolding={visible && flight === 'out' ? '' : undefined}
      aria-hidden={!interactive || undefined} inert={!interactive}
      style={{ left: current.x, top: current.y, width: current.width, height: current.height, zIndex: stackOrder ?? (active ? 2 : 1) }}
      onPointerDownCapture={() => { if (!active && interactive) onFocus() }}
      onFocusCapture={() => { if (!active && interactive) onFocus() }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && gesture.current) {
          event.preventDefault()
          event.stopPropagation()
          clearGesture()
        }
      }}>
      <div className="workspace-titlebar" data-movable={canSnap ? '' : undefined}
        onPointerDown={(event) => startGesture(event, { kind: 'move' })}
        onDoubleClick={(event) => {
          if (canSnap && event.target instanceof Element && !event.target.closest('button, .workspace-window-scale, .workspace-snap-picker')) {
            closeScale()
            onMaximize()
          }
        }}
        {...gestureHandlers}>
        <div className="workspace-window-title" id={titleId} title={title}>{title}</div>
        <div role="group" aria-label="窗口控制" className="workspace-window-controls">
          {canSnap && (
            <SnapLayoutPicker mode={mode} bounds={bounds} onPick={(zone) => { closeScale(); onSnap(zone) }} />
          )}
          {canSnap && <>
            {mode === 'floating' && <div className="workspace-window-scale" onKeyDown={(event) => {
              if (event.key === 'Escape' && scaleOpen) {
                event.preventDefault()
                event.stopPropagation()
                closeScale()
                scaleToggle.current?.focus({ preventScroll: true })
              }
            }}>
              <button ref={scaleToggle} className="workspace-window-control" type="button" title="等比缩放窗口" aria-label="等比缩放窗口"
                aria-expanded={scaleOpen} aria-controls={scaleId} onClick={() => scaling ? closeScale() : setScaling({ reference: rect, percent: 100 })}>
                <SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>
              {scaling && <div className="workspace-window-scale-panel" id={scaleId}>
                <div className="workspace-window-scale-readout"><label htmlFor={`${scaleId}-range`}>窗口比例</label><span aria-hidden="true">{scaling.percent}%</span></div>
                <input ref={scaleInput} id={`${scaleId}-range`} type="range" min={scaleLimits.min} max={scaleLimits.max} defaultValue={scaling.percent}
                  aria-valuetext={`${scaling.percent}%`} disabled={scaleLimits.min === scaleLimits.max}
                  onPointerDown={startPointerScale} onBlur={() => finishScale(true)}
                  onKeyDown={(event) => {
                    if (!scaleKeys.has(event.key)) return
                    const currentGesture = scaleGesture.current ?? beginScale(event.currentTarget)
                    if (currentGesture && !currentGesture.cleanup) (currentGesture.keys ??= new Set()).add(event.key)
                  }} onKeyUp={(event) => {
                    const keys = scaleGesture.current?.keys
                    if (keys?.delete(event.key) && !keys.size) finishScale(true)
                  }} onChange={(event) => changeScale(event.currentTarget.valueAsNumber)} />
              </div>}
            </div>}
          </>}
          <span className="window-buttons">
            <WindowButton kind="minimize" icon={Minus} label="最小化" onClick={onMinimize} />
            {canSnap && <WindowButton kind="zoom" icon={isMaximized ? Minimize2 : Maximize2} label={isMaximized ? '还原大小' : '最大化'} onClick={() => { closeScale(); onMaximize() }} />}
            <WindowButton kind="close" icon={X} label="关闭窗口" onClick={onClose} />
          </span>
        </div>
      </div>
      <div className="workspace-pane" ref={scrollRef}>{children}</div>
      {canSnap && resizeEdges.map((edge) => <div key={edge} className={`workspace-resize-hit${edge === 'se' ? ' workspace-resize-grip' : ''}`} data-resize-edge={edge}
        aria-hidden="true" title="拖动调整窗口大小" onPointerDown={(event) => startGesture(event, { kind: 'resize', edge })} {...gestureHandlers} />)}
    </section>
  )
}

export type DockItem = {
  id: string
  title: string
  icon: LucideIcon
  active: boolean
  minimized: boolean
}

type DockProps = { items: readonly DockItem[]; onSelect: (id: string) => void }

function DockSelection({ items, onSelect }: DockProps) {
  const selected = items.find((item) => item.active)?.id
  const { hostProps, trackRef, indicatorRef, hoverIndicatorRef } = useGlassSelection<HTMLDivElement>('x', selected, onSelect)

  return <div {...hostProps} className="workspace-dock-items glass-selection">
    <div className="workspace-dock-track glass-track" ref={trackRef}>
      <span className="glass-hover-indicator" ref={hoverIndicatorRef} aria-hidden="true" />
      <span className="glass-indicator workspace-dock-bubble" ref={indicatorRef} aria-hidden="true" />
      {items.map(({ id, title, icon: Icon, active, minimized }) => (
        <button key={id} type="button" className="workspace-dock-item"
          data-workspace-dock-item={id} data-glass-value={id} data-minimized={minimized ? '' : undefined}
          aria-current={active || undefined}
          aria-label={`${minimized ? '恢复' : '切换到'}${title}`}
          title={`${title}${minimized ? '（已收起）' : active ? '（当前窗口）' : ''}`}
          onClick={() => onSelect(id)}>
          <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
          <span className="workspace-dock-title">{title}</span>
          <span className="workspace-dock-status" aria-hidden="true" />
        </button>
      ))}
    </div>
  </div>
}

export function WorkspaceDock({ items, onSelect }: DockProps) {
  const dockRef = useRef<HTMLElement>(null)
  useLiquidGlass(dockRef, { radius: 999, bezel: 20, depth: 14 })
  return (
    <div className="workspace-dock-strip">
      <nav className="workspace-dock" aria-label="窗口 Dock" ref={dockRef}>
        <div className="workspace-dock-mark" aria-hidden="true"><Columns2 size={15} strokeWidth={1.7} /></div>
        {items.length ? <DockSelection items={items} onSelect={onSelect} /> : <span className="workspace-dock-empty">未打开窗口</span>}
      </nav>
    </div>
  )
}
