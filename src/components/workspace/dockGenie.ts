import './dock-genie.css'

interface DockMotion {
  source: DOMRectReadOnly
  target: DOMRectReadOnly
  direction: 'in' | 'out'
  frame: HTMLElement
  onFinish: () => void
}

const slices = 16
const stops = [0, .14, .32, .49, .64, .78, .9, 1]
const fallbackEasing = 'cubic-bezier(.32, .72, 0, 1)'
const noop = () => {}

function measurable(rect: DOMRectReadOnly) {
  return rect.width >= 1 && rect.height >= 1 && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
}

function toMilliseconds(value: string, fallback: number) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) && number > 0 ? number * (value.endsWith('ms') ? 1 : 1000) : fallback
}

const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress
const centerX = (rect: DOMRectReadOnly) => rect.left + rect.width / 2

export function playDockGenie({ source, target, direction, frame, onFinish }: DockMotion): () => void {
  if (typeof window === 'undefined' || document.hidden || !measurable(source) || !measurable(target) ||
      typeof window.matchMedia !== 'function' || typeof Element.prototype.animate !== 'function') {
    onFinish()
    return noop
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (reduce.matches) {
    onFinish()
    return noop
  }

  const windowRect = direction === 'in' ? source : target
  const dockRect = direction === 'in' ? target : source
  const ghost = document.createElement('div')
  ghost.className = 'dock-genie'
  ghost.dataset.direction = direction
  ghost.setAttribute('aria-hidden', 'true')
  document.body.append(ghost)

  const styles = getComputedStyle(ghost)
  const opening = direction === 'out'
  const duration = toMilliseconds(styles.getPropertyValue('--dur-window-genie').trim(), opening ? 540 : 480)
  const easing = styles.getPropertyValue('--ease-window-genie').trim() || styles.getPropertyValue('--ease-out-ios').trim() || fallbackEasing
  const timing: KeyframeAnimationOptions = { duration, fill: 'both' }
  const animations: Animation[] = []
  const sliceHeight = windowRect.height / slices
  let ended = false

  function clear(finished: boolean) {
    if (ended) return
    ended = true
    document.removeEventListener('visibilitychange', visibilityChange)
    reduce.removeEventListener?.('change', motionPreferenceChange)
    for (const animation of animations) animation.cancel()
    ghost.remove()
    if (finished) onFinish()
  }

  function visibilityChange() {
    if (document.hidden) clear(true)
  }

  function motionPreferenceChange() {
    if (reduce.matches) clear(true)
  }

  try {
    const fade = ghost.animate(opening ? [
      { offset: 0, opacity: .23 },
      { offset: .28, opacity: .8 },
      { offset: .39, opacity: .69 },
      { offset: .66, opacity: 0 },
      { offset: 1, opacity: 0 },
    ] : [
      { offset: 0, opacity: .86 },
      { offset: .58, opacity: .86 },
      { offset: 1, opacity: .23 },
    ], timing)
    animations.push(fade)
    if (opening) {
      // Reveal the original frame at its normal size. Only the glass proxy bends;
      // the foreground text keeps its original size and contrast as it is uncovered.
      const lift = Math.min(30, Math.max(0, (dockRect.top - windowRect.top) * .1))
      const radius = getComputedStyle(frame).borderTopLeftRadius
      const reveal = [
        { offset: 0, shown: 0, lift },
        { offset: .3, shown: 0, lift },
        { offset: .48, shown: 30, lift: lift * .3 },
        { offset: .86, shown: 100, lift: 0 },
      ]
      animations.push(frame.animate(reveal.map(({ offset, shown, lift }) => ({
        offset, clipPath: `inset(0 0 ${100 - shown}% 0 round ${radius})`, translate: `0 ${lift}px`,
      })), timing))
      // The moving silhouette continues below the revealed area during the handoff,
      // keeping its tinted surface from passing in front of newly visible text.
      animations.push(ghost.animate(reveal.map(({ offset, shown, lift }) => ({
        offset, clipPath: `inset(${windowRect.top + lift + windowRect.height * shown / 100}px 0 0)`,
      })), timing))
    }
    // Every band is a transform-only layer. Bands near the Dock bend and
    // narrow first, while the upper edge follows, producing a single funnel.
    for (let index = 0; index < slices; index += 1) {
      const band = document.createElement('div')
      band.className = 'dock-genie-band'
      if (index === 0) band.classList.add('dock-genie-band--top')
      if (index === slices - 1) band.classList.add('dock-genie-band--bottom')
      band.style.width = `${windowRect.width}px`
      band.style.height = `${sliceHeight + (index < slices - 1 ? .8 : 0)}px`
      ghost.append(band)

      const depth = index / (slices - 1)
      const keyframes = stops.map((progress) => {
        const pull = progress ** (1.55 - depth * .94)
        const width = lerp(windowRect.width, dockRect.width, pull)
        const x = lerp(centerX(windowRect), centerX(dockRect), progress ** (1.58 - depth * .77)) - width / 2
        const height = lerp(windowRect.height, dockRect.height, progress ** 1.08)
        const top = lerp(windowRect.top, dockRect.top, progress ** 1.15)
        return {
          offset: opening ? 1 - progress : progress,
          transform: `translate3d(${x}px,${top + index * height / slices}px,0) scale(${width / windowRect.width},${height / windowRect.height})`,
        }
      })
      animations.push(band.animate(opening ? keyframes.reverse() : keyframes, { ...timing, easing }))
    }
    document.addEventListener('visibilitychange', visibilityChange)
    reduce.addEventListener?.('change', motionPreferenceChange)
    void fade.finished.then(() => clear(true), () => {})
  } catch {
    clear(true)
  }

  return () => clear(false)
}
