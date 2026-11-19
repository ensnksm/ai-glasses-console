import { Droplets, Monitor, Square } from 'lucide-react'
import { useThemePreference, type TransparencyPreference } from '../../services/theme'
import './theme-control.css'

const options = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'on', label: '开启', icon: Droplets },
  { value: 'off', label: '关闭', icon: Square },
] as const satisfies readonly { value: TransparencyPreference; label: string; icon: typeof Monitor }[]

export default function TransparencyControl() {
  const { transparency, setTransparency } = useThemePreference()
  return (
    <div className="theme-options" role="radiogroup" aria-label="透明效果">
      {options.map(({ value, label, icon: Icon }) => (
        <label key={value} className="theme-option">
          <input type="radio" name="glass-transparency" value={value} checked={transparency === value} onChange={() => setTransparency(value)} />
          <span><Icon size={15} aria-hidden="true" />{label}</span>
        </label>
      ))}
    </div>
  )
}
