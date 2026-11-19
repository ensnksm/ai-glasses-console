import { useLayoutEffect, useRef } from 'react'
import { createSpring, spring } from '../../services/motion'

export default function Switch({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const thumbRef = useRef<HTMLSpanElement>(null)
  const driver = useRef<ReturnType<typeof createSpring> | null>(null)
  const initialProgress = useRef(Number(checked))

  useLayoutEffect(() => {
    const thumb = thumbRef.current
    if (!thumb) return
    const nextDriver = createSpring([initialProgress.current], ([progress], _, moving) => {
      if (moving) thumb.style.setProperty('--switch-progress', String(progress))
      else thumb.style.removeProperty('--switch-progress')
      thumb.toggleAttribute('data-moving', moving)
    }, spring.snappy, 0.004)
    driver.current = nextDriver
    return () => nextDriver.stop()
  }, [])

  useLayoutEffect(() => { driver.current?.setTarget([Number(checked)]) }, [checked])

  return (
    <button type="button" className="module-switch" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)}>
      <span ref={thumbRef} className="module-switch-thumb" aria-hidden="true"><span className="module-switch-knob" /></span>
    </button>
  )
}
