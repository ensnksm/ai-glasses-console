export type WindowRect = { x: number; y: number; width: number; height: number }
export type WorkBounds = { width: number; height: number }
/** Where a window can be snapped: four halves and four quarters of the workspace. */
export type SnapSide = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export const snapZones: readonly { zone: SnapSide; label: string }[] = [
  { zone: 'left', label: '左半屏' },
  { zone: 'right', label: '右半屏' },
  { zone: 'top', label: '上半屏' },
  { zone: 'bottom', label: '下半屏' },
  { zone: 'top-left', label: '左上角' },
  { zone: 'top-right', label: '右上角' },
  { zone: 'bottom-left', label: '左下角' },
  { zone: 'bottom-right', label: '右下角' },
]
// Each zone as cells of a 2×2 grid (bits: top-left 1, top-right 2, bottom-left 4, bottom-right 8).
const zoneCells: Record<SnapSide, number> = {
  left: 5, right: 10, top: 3, bottom: 12, 'top-left': 1, 'top-right': 2, 'bottom-left': 4, 'bottom-right': 8,
}
export type WindowMode = 'floating' | 'maximized' | SnapSide
export const resizeEdges = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const
export type ResizeEdge = typeof resizeEdges[number]

const inset = 12
const gap = 12
const minWidth = 440
const minHeight = 300

function edges(bounds: WorkBounds) {
  const x = bounds.width >= 320 ? inset : 0
  const y = bounds.height >= 280 ? inset : 0
  return { x, y, width: Math.max(0, bounds.width - 2 * x), height: Math.max(0, bounds.height - 2 * y) }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function canSplitWorkspace(bounds: WorkBounds) {
  const available = edges(bounds)
  return available.width >= 2 * minWidth + gap && available.height >= minHeight
}

/** Whether a zone leaves each window at least the minimum window size. */
export function canSnapZone(zone: SnapSide, bounds: WorkBounds) {
  const available = edges(bounds)
  const wide = available.width >= 2 * minWidth + gap
  const tall = available.height >= 2 * minHeight + gap
  if (zone === 'left' || zone === 'right') return wide && available.height >= minHeight
  if (zone === 'top' || zone === 'bottom') return tall && available.width >= minWidth
  return wide && tall
}

/** Two snapped windows overlap when their zones share a grid cell. */
export function zonesOverlap(a: SnapSide, b: SnapSide) {
  return (zoneCells[a] & zoneCells[b]) !== 0
}

export function isSnapZone(mode: WindowMode): mode is SnapSide {
  return mode !== 'floating' && mode !== 'maximized'
}

export function clampWindowRect(rect: WindowRect, bounds: WorkBounds): WindowRect {
  const available = edges(bounds)
  const width = clamp(rect.width, Math.min(minWidth, available.width), available.width)
  const height = clamp(rect.height, Math.min(minHeight, available.height), available.height)
  return {
    x: clamp(rect.x, available.x, available.x + available.width - width),
    y: clamp(rect.y, available.y, available.y + available.height - height),
    width, height,
  }
}

export function initialWindowRect(bounds: WorkBounds, index: number): WindowRect {
  const available = edges(bounds)
  const width = clamp(available.width * .71, Math.min(minWidth, available.width), Math.min(860, available.width))
  const height = clamp(available.height * .82, Math.min(minHeight, available.height), Math.min(660, available.height))
  const step = (index % 5) * 22
  return clampWindowRect({
    x: Math.round(available.x + (available.width - width) * .46 + step),
    y: Math.round(available.y + (available.height - height) * .36 + step),
    width: Math.round(width),
    height: Math.round(height),
  }, bounds)
}

export function getWindowRect(mode: WindowMode, floating: WindowRect, bounds: WorkBounds): WindowRect {
  if (!canSplitWorkspace(bounds) || mode === 'maximized') return edges(bounds)
  if (mode === 'floating') return clampWindowRect(floating, bounds)
  if (!canSnapZone(mode, bounds)) return edges(bounds)
  const available = edges(bounds)
  const leftWidth = Math.floor((available.width - gap) / 2)
  const topHeight = Math.floor((available.height - gap) / 2)
  const cells = zoneCells[mode]
  const spansLeft = (cells & 5) !== 0
  const spansRight = (cells & 10) !== 0
  const spansTop = (cells & 3) !== 0
  const spansBottom = (cells & 12) !== 0
  const x = spansLeft ? available.x : available.x + leftWidth + gap
  const y = spansTop ? available.y : available.y + topHeight + gap
  const width = spansLeft && spansRight ? available.width : spansLeft ? leftWidth : available.width - leftWidth - gap
  const height = spansTop && spansBottom ? available.height : spansTop ? topHeight : available.height - topHeight - gap
  return { x, y, width, height }
}

export function getResizeRect(start: WindowRect, deltaX: number, deltaY: number, bounds: WorkBounds, edge: ResizeEdge): WindowRect {
  const available = edges(bounds)
  const next = { ...start }
  const right = start.x + start.width
  const bottom = start.y + start.height
  const minX = Math.min(minWidth, start.width)
  const minY = Math.min(minHeight, start.height)

  if (edge.includes('w')) {
    next.x = clamp(start.x + deltaX, available.x, right - minX)
    next.width = right - next.x
  } else if (edge.includes('e')) {
    next.width = clamp(start.width + deltaX, minX, available.x + available.width - start.x)
  }
  if (edge.includes('n')) {
    next.y = clamp(start.y + deltaY, available.y, bottom - minY)
    next.height = bottom - next.y
  } else if (edge.includes('s')) {
    next.height = clamp(start.height + deltaY, minY, available.y + available.height - start.y)
  }
  return next
}

export function getWindowScaleLimits(rect: WindowRect, bounds: WorkBounds) {
  const available = edges(bounds)
  if (!rect.width || !rect.height) return { min: 100, max: 100 }
  // Fix the top-right corner so the control does not move under the pointer.
  const maxWidth = rect.x + rect.width - available.x
  const maxHeight = available.y + available.height - rect.y
  return {
    min: Math.min(100, Math.ceil(100 * Math.max(minWidth / rect.width, minHeight / rect.height))),
    max: Math.max(100, Math.floor(100 * Math.min(maxWidth / rect.width, maxHeight / rect.height) + .00001)),
  }
}

export function scaleWindowRect(rect: WindowRect, percent: number): WindowRect {
  const width = rect.width * percent / 100
  return { ...rect, x: rect.x + rect.width - width, width, height: rect.height * percent / 100 }
}
