import { createContext, useContext } from 'react'
import type { ComponentPropsWithoutRef, RefObject } from 'react'

export const WorkspaceContext = createContext<{ openWindow: (to: string) => void } | null>(null)
export const WindowContext = createContext<{
  search: string
  setSearch: (next: URLSearchParams) => void
  scrollRef: RefObject<HTMLDivElement | null>
  visible: boolean
} | null>(null)

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('WorkspaceContext is missing')
  return value
}

export function useWindow() {
  const value = useContext(WindowContext)
  if (!value) throw new Error('WindowContext is missing')
  return value
}

export function WorkspaceLink({ to, onClick, target, download, ...rest }: Omit<ComponentPropsWithoutRef<'a'>, 'href'> & { to: string }) {
  const { openWindow } = useWorkspace()
  return <a {...rest} href={to} target={target} download={download} onClick={(event) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey
      || (target && target !== '_self') || download !== undefined) return
    event.preventDefault()
    openWindow(to)
  }} />
}
