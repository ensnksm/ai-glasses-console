import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemePreference, type ThemePreference } from '../../services/theme'
import './theme-control.css'

const themes = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const satisfies readonly { value: ThemePreference; label: string; icon: typeof Sun }[]

export default function ThemeControl() {
  const { preference, setPreference } = useThemePreference()
  return (
    <div className="theme-options" role="radiogroup" aria-label="系统主题">
      {themes.map(({ value, label, icon: Icon }) => (
        <label key={value} className="theme-option">
          <input type="radio" name="system-theme" value={value} checked={preference === value} onChange={() => setPreference(value)} />
          <span><Icon size={15} aria-hidden="true" />{label}</span>
        </label>
      ))}
    </div>
  )
}
