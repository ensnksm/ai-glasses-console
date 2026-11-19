import { useId, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { GripVertical, X } from 'lucide-react'
import { createSpring, spring } from '../../services/motion'

type Point = { x: number; time: number }
type Drag = {
  pointerId: number
  startX: number
  offset: number
  width: number
  points: Point[]
}

const dragThreshold = 0.3
const velocityWindow = 90
const velocityThreshold = 800

function releaseVelocity(points: Point[], releaseTime: number) {
  const latest = points.at(-1)
  const earliest = points.find((point) => releaseTime - point.time <= velocityWindow)
  if (!latest || !earliest || latest.time - earliest.time < 8 || releaseTime - latest.time > 64) return 0
  return Math.min(2200, Math.max(-2200, (latest.x - earliest.x) * 1000 / (latest.time - earliest.time)))
}

function resist(offset: number, width: number) {
  const rubberBand = (distance: number) => distance * 0.2 / (1 + Math.abs(distance) / width)
  if (offset < 0) return rubberBand(offset)
  if (offset > width) return width + rubberBand(offset - width)
  return offset
}

export default function DetailsDrawer({ title, subtitle, onClose, children }: {
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const ref = useRef<HTMLDialogElement>(null)
  const gripRef = useRef<HTMLSpanElement>(null)
  const driver = useRef<ReturnType<typeof createSpring> | null>(null)
  const drag = useRef<Drag | null>(null)
  const offset = useRef(0)
  const closing = useRef(false)

  function paint(dialog: HTMLDialogElement, value: number, moving: boolean) {
    offset.current = value
    dialog.style.transform = value ? `translate3d(${value}px, 0, 0)` : ''
    dialog.toggleAttribute('data-moving', moving)
  }

  function animateTo(dialog: HTMLDialogElement, target: number, {
    preset = 'smooth', velocity = 0, restDelta = 1, done,
  }: { preset?: 'smooth' | 'snappy'; velocity?: number; restDelta?: number; done?: () => void } = {}) {
    driver.current?.stop()
    const nextDriver = createSpring([offset.current], ([x], _, moving) => {
      paint(dialog, x, moving)
      if (!moving) done?.()
    }, spring[preset], restDelta)
    driver.current = nextDriver
    nextDriver.setTarget([target], { velocity: [velocity] })
  }

  function clearDrag(dialog: HTMLDialogElement) {
    const pointerId = drag.current?.pointerId
    drag.current = null
    dialog.removeAttribute('data-dragging')
    const grip = gripRef.current
    if (pointerId !== undefined && grip?.hasPointerCapture(pointerId)) grip.releasePointerCapture(pointerId)
  }

  function close(velocity = 0) {
    const dialog = ref.current
    if (!dialog?.open || closing.current) return
    closing.current = true
    clearDrag(dialog)
    dialog.dataset.closing = ''
    animateTo(dialog, dialog.offsetWidth + 24, {
      preset: 'snappy', velocity, restDelta: 5,
      done: () => { dialog.close(); onClose() },
    })
  }

  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    closing.current = false
    dialog.showModal()
    paint(dialog, dialog.offsetWidth + 24, true)
    animateTo(dialog, 0, { restDelta: 3.5 })
    return () => {
      driver.current?.stop()
      clearDrag(dialog)
      dialog.close()
    }
  }, [])

  function beginDrag(event: PointerEvent<HTMLSpanElement>) {
    const dialog = ref.current
    if (!dialog || !event.isPrimary || event.button !== 0 || closing.current || drag.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    driver.current?.stop()
    dialog.dataset.dragging = ''
    drag.current = { pointerId: event.pointerId, startX: event.clientX, offset: offset.current, width: dialog.offsetWidth, points: [{ x: event.clientX, time: event.timeStamp }] }
  }

  function moveDrag(event: PointerEvent<HTMLSpanElement>) {
    const gesture = drag.current
    const dialog = ref.current
    if (!gesture || !dialog || gesture.pointerId !== event.pointerId) return
    gesture.points = gesture.points.filter(({ time }) => event.timeStamp - time <= velocityWindow)
    gesture.points.push({ x: event.clientX, time: event.timeStamp })
    paint(dialog, resist(gesture.offset + event.clientX - gesture.startX, gesture.width), true)
  }

  function endDrag(event: PointerEvent<HTMLSpanElement>, cancelled = false) {
    const gesture = drag.current
    const dialog = ref.current
    if (!gesture || !dialog || gesture.pointerId !== event.pointerId) return
    const distance = event.clientX - gesture.startX
    const velocity = cancelled ? 0 : releaseVelocity(gesture.points, event.timeStamp)
    clearDrag(dialog)
    // A flick projects forward briefly; stray clicks and tiny drags still return to rest.
    const flick = distance >= 18 && velocity > velocityThreshold && distance + velocity * 0.16 >= gesture.width * dragThreshold
    if (!cancelled && (distance >= gesture.width * dragThreshold || flick)) close(Math.max(0, velocity))
    else animateTo(dialog, 0, { velocity })
  }

  return (
    <dialog
      ref={ref}
      className="module-drawer"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); close() }}
      onClick={(event) => { if (event.target === event.currentTarget) close() }}
    >
      <div className="module-drawer-inner">
        <header className="module-drawer-header">
          <span
            ref={gripRef}
            className="module-drawer-grip"
            aria-hidden="true"
            title="向右拖动关闭详情"
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={(event) => endDrag(event)}
            onPointerCancel={(event) => endDrag(event, true)}
            onLostPointerCapture={(event) => endDrag(event, true)}
          ><GripVertical size={16} /></span>
          <div className="module-drawer-heading"><h2 id={titleId}>{title}</h2><p>{subtitle}</p></div>
          <button type="button" className="icon-button" aria-label="关闭事件详情" onClick={() => close()}><X size={18} /></button>
        </header>
        <div className="module-drawer-body">{children}</div>
      </div>
    </dialog>
  )

}
