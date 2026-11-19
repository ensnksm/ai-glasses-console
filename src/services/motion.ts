export const chartAnimationMs = 680

export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 1 },
  smooth: { type: 'spring', stiffness: 300, damping: 30, mass: 1 },
  gentle: { type: 'spring', stiffness: 180, damping: 26, mass: 1 },
  bouncy: { type: 'spring', stiffness: 420, damping: 22, mass: 1 },
} as const

type SpringPreset = typeof spring[keyof typeof spring]
type SpringTarget = { immediate?: boolean; velocity?: readonly number[] }
type RenderSpring = (values: readonly number[], velocities: readonly number[], moving: boolean) => void

export function createSpring(initial: readonly number[], render: RenderSpring, preset: SpringPreset = spring.snappy, restDelta = 0.3) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const position = [...initial]
  const velocity = initial.map(() => 0)
  let target = [...initial]
  let frame = 0
  let previousTime = 0
  const decayRate = preset.damping / (2 * preset.mass)
  const frequency = Math.sqrt(preset.stiffness / preset.mass - decayRate ** 2)
  const restSpeed = restDelta * 30

  function stop() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    velocity.fill(0)
  }

  function paintTarget(immediateVelocity?: readonly number[]) {
    stop()
    target.forEach((value, index) => { position[index] = value })
    render(position, immediateVelocity ?? velocity, false)
  }

  function animate(timestamp: number) {
    if (preference.matches) {
      paintTarget()
      return
    }

    // The analytical damped spring keeps its velocity when retargeted, even after a slow frame.
    const elapsed = Math.max(0, (timestamp - previousTime) / 1000)
    previousTime = timestamp
    const decay = Math.exp(-decayRate * elapsed)
    const cosine = Math.cos(frequency * elapsed)
    const sine = Math.sin(frequency * elapsed)
    let atRest = true

    for (let index = 0; index < position.length; index++) {
      const distance = position[index] - target[index]
      const momentum = (velocity[index] + decayRate * distance) / frequency
      const nextDistance = distance * cosine + momentum * sine
      position[index] = target[index] + decay * nextDistance
      velocity[index] = decay * ((momentum * cosine - distance * sine) * frequency - decayRate * nextDistance)
      if (Math.abs(position[index] - target[index]) > restDelta || Math.abs(velocity[index]) > restSpeed) atRest = false
    }

    if (atRest) {
      paintTarget()
      return
    }
    render(position, velocity, true)
    frame = requestAnimationFrame(animate)
  }

  function setTarget(next: readonly number[], options: SpringTarget = {}) {
    if (!options.immediate && !options.velocity && target.every((value, index) => next[index] === value)) return
    target = [...next]
    if (preference.matches || options.immediate) {
      paintTarget(preference.matches ? undefined : options.velocity)
      return
    }
    if (options.velocity) velocity.forEach((_, index) => { velocity[index] = options.velocity?.[index] ?? 0 })
    if (frame) {
      render(position, velocity, true)
      return
    }
    previousTime = performance.now()
    render(position, velocity, true)
    frame = requestAnimationFrame(animate)
  }

  return { setTarget, stop }
}
