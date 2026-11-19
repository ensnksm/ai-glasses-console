import { useRef } from 'react'
import { Search, X } from 'lucide-react'

export default function SearchInput({ label, value, onChange, className = '' }: {
  label: string; value: string; onChange: (value: string) => void; className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className={`search-field ${className}`}>
      <Search className="search-field-icon" size={16} aria-hidden="true" />
      <input ref={input} className="field-input" type="search" aria-label={label} placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} />
      <button className="search-field-clear" type="button" aria-label={`清除${label}`} disabled={!value} onClick={() => {
        onChange('')
        input.current?.focus()
      }}><X size={15} aria-hidden="true" /></button>
    </div>
  )
}
