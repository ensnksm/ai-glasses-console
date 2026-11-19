import { createContext, useContext, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
/** Glass materials: follow the OS "reduce transparency" setting, or force them on/off for this browser. */
export type TransparencyPreference = 'system' | 'on' | 'off'

const ThemeContext = createContext<{
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
  transparency: TransparencyPreference
  setTransparency: (preference: TransparencyPreference) => void
  systemReducesTransparency: boolean
} | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const initial = document.documentElement.dataset.themePreference
    return initial === 'dark' || initial === 'system' ? initial : 'light'
  })

  const [transparency, setTransparency] = useState<TransparencyPreference>(() => {
    const initial = document.documentElement.dataset.transparency
    return initial === 'system' || initial === 'off' ? initial : 'on'
  })
  const [systemReducesTransparency, setSystemReduces] = useState(() => window.matchMedia('(prefers-reduced-transparency: reduce)').matches)

  useLayoutEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-reduced-transparency: reduce)')
    const apply = () => {
      setSystemReduces(media.matches)
      root.dataset.transparency = transparency
      root.dataset.glass = transparency === 'on' || (transparency === 'system' && !media.matches) ? 'on' : 'off'
    }
    apply()
    try { localStorage.setItem('aig-ui-transparency', transparency) } catch { /* The current session still works. */ }
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [transparency])

  useLayoutEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      root.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference
      root.dataset.themePreference = preference
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--canvas').trim())
    }
    apply()
    try { localStorage.setItem('aig-ui-theme', preference) } catch { /* The current session still works. */ }
    if (preference !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])

  return <ThemeContext.Provider value={{ preference, setPreference, transparency, setTransparency, systemReducesTransparency }}>{children}</ThemeContext.Provider>
}

export function useThemePreference() {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('ThemeProvider is missing')
  return theme
}
