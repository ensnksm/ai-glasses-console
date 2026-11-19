import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Liquid Glass lens for a rounded element.
 *
 * Builds a displacement map from the element's own rounded-rect shape: inside a bezel band along the edge,
 * the backdrop is sampled further inward, so whatever passes behind the glass bends at the rim like a lens.
 * The filter is exposed as the CSS custom property `--lg-lens` (e.g. `backdrop-filter: blur(4px) var(--lg-lens,)`).
 *
 * Only Chromium renders SVG filters inside backdrop-filter; other browsers keep the plain frosted layer.
 */

const svgNamespace = 'http://www.w3.org/2000/svg'
let defsRoot: SVGSVGElement | null = null
let counter = 0

function lensSupported() {
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands
  return Boolean(brands?.some(({ brand }) => /Chromium|Google Chrome|Microsoft Edge/.test(brand)))
}

function defs() {
  if (defsRoot?.isConnected) return defsRoot
  defsRoot = document.createElementNS(svgNamespace, 'svg')
  defsRoot.setAttribute('aria-hidden', 'true')
  defsRoot.setAttribute('width', '0')
  defsRoot.setAttribute('height', '0')
  defsRoot.style.position = 'absolute'
  document.body.prepend(defsRoot)
  return defsRoot
}

/** Signed distance to a rounded rectangle centred in a w×h box; negative inside. */
function roundedRectDistance(x: number, y: number, halfWidth: number, halfHeight: number, radius: number) {
  const qx = Math.abs(x - halfWidth) - (halfWidth - radius)
  const qy = Math.abs(y - halfHeight) - (halfHeight - radius)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

function displacementMap(width: number, height: number, radius: number, bezel: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  const image = context.createImageData(width, height)
  const pixels = image.data
  const halfWidth = width / 2
  const halfHeight = height / 2
  const corner = Math.min(radius, halfWidth, halfHeight)
  const distance = (x: number, y: number) => roundedRectDistance(x, y, halfWidth, halfHeight, corner)
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = (row * width + column) * 4
      const x = column + .5
      const y = row + .5
      const inside = -distance(x, y)
      let red = 128
      let green = 128
      if (inside > 0 && inside < bezel) {
        // Convex rim: strongest bend at the very edge, easing to flat glass at the inner edge of the bezel.
        const amount = (1 - inside / bezel) ** 2
        const normalX = distance(x + 1, y) - distance(x - 1, y)
        const normalY = distance(x, y + 1) - distance(x, y - 1)
        const length = Math.hypot(normalX, normalY) || 1
        red = 128 - (normalX / length) * amount * 127
        green = 128 - (normalY / length) * amount * 127
      }
      pixels[index] = red
      pixels[index + 1] = green
      pixels[index + 2] = 128
      pixels[index + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL()
}

export function useLiquidGlass<T extends HTMLElement>(ref: RefObject<T | null>, { radius, bezel, depth }: {
  /** Corner radius in px; use a large number for capsules. */
  radius: number
  /** Width of the bending rim in px. */
  bezel: number
  /** Largest backdrop shift at the rim in px. */
  depth: number
}) {
  const options = useRef({ radius, bezel, depth })
  options.current = { radius, bezel, depth }

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !lensSupported()) return
    const id = `liquid-lens-${++counter}`
    const filter = document.createElementNS(svgNamespace, 'filter')
    filter.id = id
    filter.setAttribute('filterUnits', 'userSpaceOnUse')
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse')
    filter.setAttribute('color-interpolation-filters', 'sRGB')
    const map = document.createElementNS(svgNamespace, 'feImage')
    map.setAttribute('result', 'map')
    map.setAttribute('preserveAspectRatio', 'none')
    const shift = document.createElementNS(svgNamespace, 'feDisplacementMap')
    shift.setAttribute('in', 'SourceGraphic')
    shift.setAttribute('in2', 'map')
    shift.setAttribute('xChannelSelector', 'R')
    shift.setAttribute('yChannelSelector', 'G')
    filter.append(map, shift)
    defs().append(filter)

    let size = ''
    let frame = 0
    const build = () => {
      const width = Math.round(element.offsetWidth)
      const height = Math.round(element.offsetHeight)
      if (!width || !height || `${width}x${height}` === size) return
      size = `${width}x${height}`
      const { radius: corner, bezel: rim, depth: reach } = options.current
      const url = displacementMap(width, height, corner, Math.min(rim, width / 2, height / 2))
      if (!url) return
      for (const node of [filter, map]) {
        node.setAttribute('x', '0')
        node.setAttribute('y', '0')
        node.setAttribute('width', String(width))
        node.setAttribute('height', String(height))
      }
      map.setAttribute('href', url)
      shift.setAttribute('scale', String(reach * 2))
      element.style.setProperty('--lg-lens', `url(#${id})`)
    }
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(build)
    })
    observer.observe(element)
    build()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      filter.remove()
      element.style.removeProperty('--lg-lens')
    }
  }, [ref])
}
