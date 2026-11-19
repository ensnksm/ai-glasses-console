import type { ReactNode } from 'react'
import { useGlassSelection } from '../../hooks/useGlassSelection'

type Option<Value extends string> = { value: Value; label: string; icon?: ReactNode }

export default function GlassSegmentedControl<Value extends string>({ label, options, value, onChange, className }: {
  label: string
  options: readonly Option<Value>[]
  value: Value | undefined
  onChange: (value: Value) => void
  className?: string
}) {
  const { hostProps, trackRef, indicatorRef } = useGlassSelection<HTMLDivElement>('x', value, (next) => {
    const option = options.find((item) => item.value === next)
    if (option) onChange(option.value)
  })

  return (
    <div {...hostProps} className={`segmented glass-selection${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      <div className="segmented-track glass-track" ref={trackRef}>
        <span className="glass-indicator" ref={indicatorRef} aria-hidden="true" />
        {options.map((option) => (
          <button key={option.value} type="button" data-glass-value={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
            {option.icon}{option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
