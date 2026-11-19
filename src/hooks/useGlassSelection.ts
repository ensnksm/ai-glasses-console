import { useCallback, useLayoutEffect, useRef } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, RefObject } from 'react'
import { createSpring } from '../services/motion'

type Rect = [x: number, y: number, width: number, height: number]
type Axis = 'x' | 'y'
type Gesture = {
  item: HTMLElement
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  rect: Rect
  timestamp: number
  speed: number
  dragging: boolean
}

const itemSelector = '[data-glass-value]'
const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max))

function useIndicator(ref: RefObject<HTMLSpanElement | null>, stretchAxis?: Axis) {
  const layer = useRef<{ spring: ReturnType<typeof createSpring>; base: [number, number] } | null>(null)

  useLayoutEffect(() => () => {
    layer.current?.spring.stop()
    layer.current = null
  }, [])

  return useCallback((rect: Rect | null, options?: { immediate?: boolean; velocity?: readonly number[] }) => {
    const element = ref.current
    if (!element) return
    if (!rect) {
      layer.current?.spring.stop()
      element.removeAttribute('data-moving')
      element.removeAttribute('data-visible')
      return
    }

    const [, , width, height] = rect
    const first = !layer.current
    if (!layer.current) {
      const base: [number, number] = [0, 0]
      const spring = createSpring(rect, ([x, y, w, h], velocities, moving) => {
        const motion = stretchAxis ? Math.min(.08, Math.abs(velocities[stretchAxis === 'x' ? 0 : 1]) / 16_000) : 0
        const extraWidth = stretchAxis === 'x' ? w * motion : 0
        const extraHeight = stretchAxis === 'y' ? h * motion : 0
        element.style.transform = `translate3d(${x - extraWidth / 2}px, ${y - extraHeight / 2}px, 0) scale(${(w + extraWidth) / base[0]}, ${(h + extraHeight) / base[1]})`
        element.toggleAttribute('data-moving', moving)
      })
      layer.current = { spring, base }
    }
    const { spring, base } = layer.current
    // Commit geometry on target changes; the spring only animates the transform.
    if (base[0] !== width) element.style.setProperty('--glass-width', `${base[0] = width}px`)
    if (base[1] !== height) element.style.setProperty('--glass-height', `${base[1] = height}px`)
    spring.setTarget(rect, { ...options, immediate: first || options?.immediate })
    element.setAttribute('data-visible', '')
  }, [ref, stretchAxis])
}

export function useGlassSelection<Host extends HTMLElement>(axis: Axis, selected: string | undefined, onSelect: (value: string) => void) {
  const hostRef = useRef<Host>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const hoverIndicatorRef = useRef<HTMLSpanElement>(null)
  const focusIndicatorRef = useRef<HTMLSpanElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const preview = useRef<HTMLElement | null>(null)
  const hoverItem = useRef<HTMLElement | null>(null)
  const focusItem = useRef<HTMLElement | null>(null)
  const suppressClick = useRef(false)
  const place = useIndicator(indicatorRef, axis)
  const placeHover = useIndicator(hoverIndicatorRef)
  const placeFocus = useIndicator(focusIndicatorRef)

  function findItem(target: EventTarget | null) {
    const item = target instanceof Element ? target.closest<HTMLElement>(itemSelector) : null
    return item && trackRef.current?.contains(item) ? item : null
  }

  const rectFor = useCallback((item: HTMLElement | null): Rect | null => {
    const track = trackRef.current
    if (!track || !item) return null
    const bounds = track.getBoundingClientRect()
    const rect = item.getBoundingClientRect()
    return rect.width && rect.height ? [rect.left - bounds.left, rect.top - bounds.top, rect.width, rect.height] : null
  }, [])

  const selectedItem = useCallback(() => trackRef.current?.querySelector<HTMLElement>(
    `${itemSelector}:is([aria-current="page"], [aria-current="true"], [aria-pressed="true"])`,
  ) ?? null, [])

  const setPreview = useCallback((item: HTMLElement | null) => {
    if (preview.current === item) return
    preview.current?.removeAttribute('data-glass-preview')
    item?.setAttribute('data-glass-preview', '')
    preview.current = item
  }, [])

  const showHover = useCallback((item: HTMLElement | null) => {
    if (item === hoverItem.current) return
    const entering = !hoverItem.current
    hoverItem.current = item
    placeHover(rectFor(item), { immediate: entering })
  }, [placeHover, rectFor])

  const showFocus = useCallback((item: HTMLElement | null) => {
    if (item === focusItem.current) return
    const entering = !focusItem.current
    focusItem.current = item
    const rect = rectFor(item)
    placeFocus(rect, { immediate: entering })
    hostRef.current?.toggleAttribute('data-focus-ring', Boolean(rect && focusIndicatorRef.current))
  }, [placeFocus, rectFor])

  const endGesture = useCallback((target: HTMLElement | null = null) => {
    const current = gesture.current
    if (!current) return
    gesture.current = null
    const host = hostRef.current
    host?.removeAttribute('data-gesture')
    current.item.removeAttribute('data-glass-pressed')
    if (host?.hasPointerCapture(current.pointerId)) host.releasePointerCapture(current.pointerId)
    setPreview(null)
    const speed = performance.now() - current.timestamp < 80 ? current.speed : 0
    place(rectFor(target ?? selectedItem()), current.dragging ? { velocity: axis === 'x' ? [speed, 0, 0, 0] : [0, speed, 0, 0] } : undefined)
  }, [axis, place, rectFor, selectedItem, setPreview])

  const cancel = useCallback(() => {
    if (!gesture.current) return
    suppressClick.current = true
    endGesture()
  }, [endGesture])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const align = () => {
      if (!gesture.current) place(rectFor(selectedItem()), { immediate: true })
      placeHover(rectFor(hoverItem.current), { immediate: true })
      placeFocus(rectFor(focusItem.current), { immediate: true })
    }
    const observer = new ResizeObserver(align)
    observer.observe(track)
    track.querySelectorAll(itemSelector).forEach((item) => observer.observe(item))
    const blur = () => { cancel(); showHover(null); showFocus(null) }
    window.addEventListener('blur', blur)
    return () => {
      observer.disconnect()
      window.removeEventListener('blur', blur)
    }
  }, [cancel, place, placeHover, placeFocus, rectFor, selectedItem, showFocus, showHover])

  useLayoutEffect(() => {
    cancel()
    place(rectFor(selectedItem()))
  }, [selected, cancel, place, rectFor, selectedItem])

  function onPointerDown(event: PointerEvent<Host>) {
    if (!event.isPrimary || event.button !== 0) return
    suppressClick.current = false
    if (event.pointerType !== 'mouse' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const item = findItem(event.target)
    const rect = rectFor(item)
    if (!item || !rect) return
    const bounds = item.getBoundingClientRect()
    gesture.current = {
      item, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top,
      rect, dragging: false, timestamp: performance.now(), speed: 0,
    }
    event.currentTarget.dataset.gesture = 'pressed'
    item.dataset.glassPressed = ''
    showHover(null)
    setPreview(item)
    place(rect)
  }

  function onPointerMove(event: PointerEvent<Host>) {
    const current = gesture.current
    const track = trackRef.current
    if (!current || !track || event.pointerId !== current.pointerId) {
      if (!current && event.pointerType === 'mouse') showHover(findItem(event.target))
      return
    }
    if ((event.buttons & 1) === 0) {
      cancel()
      return
    }
    if (!current.dragging) {
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 5) return
      current.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.dataset.gesture = 'dragging'
    }
    const bounds = track.getBoundingClientRect()
    const [priorX, priorY, width, height] = current.rect
    const x = axis === 'x' ? clamp(event.clientX - bounds.left - current.offsetX, bounds.width - width) : priorX
    const y = axis === 'y' ? clamp(event.clientY - bounds.top - current.offsetY, bounds.height - height) : priorY
    const now = performance.now()
    const elapsed = now - current.timestamp
    const distance = axis === 'x' ? x - priorX : y - priorY
    const speed = Math.max(-1800, Math.min(1800, distance * 1000 / Math.max(elapsed, 8)))
    current.speed = (elapsed > 80 ? 0 : current.speed * .35) + speed * .65
    current.timestamp = now
    current.rect = [x, y, width, height]
    place(current.rect, { immediate: true, velocity: axis === 'x' ? [current.speed, 0, 0, 0] : [0, current.speed, 0, 0] })
    // Pointer capture keeps events on the host even when the mouse leaves it.
    setPreview(findItem(document.elementFromPoint(event.clientX, event.clientY)))
  }

  function onPointerUp(event: PointerEvent<Host>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    const target = findItem(document.elementFromPoint(event.clientX, event.clientY))
    suppressClick.current = current.dragging
    endGesture(current.dragging || target === current.item ? target : null)
    const value = target?.dataset.glassValue
    if (current.dragging && target && value !== undefined) {
      target.focus({ preventScroll: true })
      onSelect(value)
    }
  }

  function cancelPointer(event: PointerEvent<Host>) {
    if (gesture.current?.pointerId === event.pointerId) cancel()
  }

  function onClickCapture(event: MouseEvent<Host>) {
    if (!suppressClick.current || event.detail === 0) return
    suppressClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  function onKeyDown(event: KeyboardEvent<Host>) {
    if (event.key === 'Escape' && gesture.current) {
      event.preventDefault()
      cancel()
      return
    }
    const current = findItem(event.target)
    const backwards = axis === 'y' ? 'ArrowUp' : 'ArrowLeft'
    const forwards = axis === 'y' ? 'ArrowDown' : 'ArrowRight'
    if (!current || ![backwards, forwards, 'Home', 'End'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(itemSelector)]
    const index = items.indexOf(current)
    if (index < 0) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === backwards ? -1 : 1) + items.length) % items.length
    items[next]?.focus()
  }

  function onFocus(event: FocusEvent<Host>) {
    const item = findItem(event.target)
    showFocus(item?.matches(':focus-visible') ? item : null)
  }

  function onBlur(event: FocusEvent<Host>) {
    if (!findItem(event.relatedTarget)) showFocus(null)
  }

  return {
    trackRef, indicatorRef, hoverIndicatorRef, focusIndicatorRef,
    hostProps: {
      ref: hostRef, onPointerDown, onPointerMove, onPointerUp, onClickCapture, onFocus, onBlur, onKeyDown,
      onPointerCancel: cancelPointer, onLostPointerCapture: cancelPointer,
      onPointerLeave: (event: PointerEvent<Host>) => {
        showHover(null)
        if (!gesture.current?.dragging) cancelPointer(event)
      },
    },
  }
}
