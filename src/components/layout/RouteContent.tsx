import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'

export interface ScrollHistory {
  pathname: string | null
  positions: Map<string, number>
}

export default function RouteContent({ scrollRoot, scrollHistory }: {
  scrollRoot: RefObject<HTMLDivElement | null>
  scrollHistory: RefObject<ScrollHistory>
}) {
  const { pathname, key } = useLocation()
  const navigationType = useNavigationType()
  const isNewPage = scrollHistory.current.pathname !== pathname

  useLayoutEffect(() => {
    const root = scrollRoot.current
    if (!root) return
    const history = scrollHistory.current
    if (history.pathname !== pathname) {
      root.scrollTop = navigationType === 'POP' ? (history.positions.get(key) ?? 0) : 0
      history.pathname = pathname
    }
    const record = () => {
      history.positions.set(key, root.scrollTop)
      root.toggleAttribute('data-scrolled', root.scrollTop > 0)
    }
    record()
    root.addEventListener('scroll', record, { passive: true })
    return () => root.removeEventListener('scroll', record)
  }, [key, pathname, navigationType, scrollHistory, scrollRoot])

  return <div className="route-content" key={pathname} data-enter={isNewPage ? '' : undefined}><Outlet /></div>
}
