import { useLayoutEffect, useRef } from 'react'

export function useChangeFeedback<Element extends HTMLElement>(value: unknown, effectClass: string) {
  const ref = useRef<Element>(null)
  const previous = useRef(value)
  useLayoutEffect(() => {
    if (Object.is(value, previous.current)) return
    previous.current = value
    const element = ref.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const stop = () => element.classList.remove(effectClass)
    element.classList.add(effectClass)
    element.addEventListener('animationend', stop, { once: true })
    return () => {
      element.removeEventListener('animationend', stop)
      stop()
    }
  }, [value, effectClass])
  return ref
}
