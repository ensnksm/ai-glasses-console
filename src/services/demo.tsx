import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AIEvent, ReviewDecision } from '../types'
import { demoReadings, seedEvents } from '../mocks/monitoring'
import { moduleAnalytics, type DemoSample } from '../mocks/modules'
import { canNow, useAuth } from './auth'
import { readDemoReviews, saveDemoReviews, type DemoReviewData } from './demoStorage'

export { assistKinds, devices, features, seedEvents } from '../mocks/monitoring'

const refreshInterval = 14_000
const newestSeed = seedEvents[0]
type SimulationState = 'idle' | 'running' | 'paused'

export function totalCalls(analytics: typeof moduleAnalytics) {
  return Object.values(analytics).reduce((totals, item) => ({
    calls: totals.calls + item.calls,
    failures: totals.failures + item.failures,
    elapsedMs: totals.elapsedMs + item.elapsedMs,
  }), { calls: 0, failures: 0, elapsedMs: 0 })
}

interface DemoState {
  events: AIEvent[]
  analytics: typeof moduleAnalytics
  reviewData: DemoReviewData
  setReview: (event: AIEvent, decision: ReviewDecision) => void
  addSample: (event: AIEvent) => void
  updateSample: (sampleId: string, patch: Partial<Pick<DemoSample, 'eligibility' | 'correction' | 'tags'>>) => void
  simulation: SimulationState
  setRefresh: (value: boolean) => void
  showEventTime: boolean
  setShowEventTime: (value: boolean) => void
}

const DemoContext = createContext<DemoState | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const { can } = useAuth()
  const canRunSimulation = can('manageSimulation')
  const [{ events, analytics }, setSession] = useState({ events: seedEvents, analytics: moduleAnalytics })
  const [reviewData, setReviewData] = useState(readDemoReviews)
  const [firstGeneratedId] = useState(() => Math.max(
    ...[newestSeed.id, ...Object.keys(reviewData.snapshots), ...Object.keys(reviewData.reviews)]
      .map((id) => Number(/^AI-(\d+)$/.exec(id)?.[1] ?? 0)),
  ) + 1)
  const [simulation, setSimulation] = useState<SimulationState>('idle')
  const [showEventTime, setShowEventTime] = useState(true)
  const tick = useRef(0)

  useEffect(() => { saveDemoReviews(reviewData) }, [reviewData])

  useEffect(() => {
    if (simulation !== 'running') return
    if (!canRunSimulation) {
      setSimulation('paused')
      return
    }
    const timer = window.setInterval(() => {
      if (!canNow('manageSimulation')) {
        setSimulation('paused')
        return
      }
      const index = tick.current++
      const event: AIEvent = {
        ...demoReadings[index % demoReadings.length],
        id: `AI-${firstGeneratedId + index}`,
        occurredAt: new Date(Date.parse(newestSeed.occurredAt) + refreshInterval * (index + 1)).toISOString(),
        outcome: 'success',
        evidence: '模拟事件，仅提供文本证据；无真实媒体。',
      }
      setSession((previous) => {
        const stats = previous.analytics[event.featureId]
        return {
          events: [event, ...previous.events.slice(0, 49)],
          analytics: { ...previous.analytics, [event.featureId]: {
            calls: stats.calls + 1,
            failures: stats.failures + Number(event.outcome === 'failed'),
            elapsedMs: stats.elapsedMs + event.elapsedMs,
          } },
        }
      })
    }, refreshInterval)
    return () => window.clearInterval(timer)
  }, [simulation, canRunSimulation, firstGeneratedId])

  function setRefresh(value: boolean) {
    if (!canNow('manageSimulation')) return
    setSimulation((previous) => value ? 'running' : previous === 'running' ? 'paused' : previous)
  }

  function saveEventSnapshot(event: AIEvent) {
    if (seedEvents.some((seed) => seed.id === event.id)) return
    setReviewData((previous) => previous.snapshots[event.id] ? previous : {
      ...previous, snapshots: { ...previous.snapshots, [event.id]: event },
    })
  }

  function setReview(event: AIEvent, decision: ReviewDecision) {
    if (!canNow('reviewResults')) return
    saveEventSnapshot(event)
    setReviewData((previous) => ({ ...previous, reviews: { ...previous.reviews, [event.id]: decision } }))
  }

  function addSample(event: AIEvent) {
    if (!canNow('addSamples')) return
    saveEventSnapshot(event)
    setReviewData((previous) => previous.samples.some((sample) => sample.eventId === event.id) ? previous : {
      ...previous,
      samples: [...previous.samples, {
        id: `S-${String(previous.samples.length + 1).padStart(3, '0')}`,
        eventId: event.id, eligibility: 'unchecked', correction: '', tags: '',
      }],
    })
  }

  function updateSample(sampleId: string, patch: Partial<Pick<DemoSample, 'eligibility' | 'correction' | 'tags'>>) {
    if (!canNow('editSamples')) return
    setReviewData((previous) => ({
      ...previous, samples: previous.samples.map((sample) => sample.id === sampleId ? { ...sample, ...patch } : sample),
    }))
  }

  return (
    <DemoContext.Provider value={{ events, analytics, reviewData, setReview, addSample, updateSample, simulation, setRefresh, showEventTime, setShowEventTime }}>
      {children}
    </DemoContext.Provider>
  )
}

function useDemoState() {
  const value = useContext(DemoContext)
  if (!value) throw new Error('DemoProvider is missing')
  return value
}

export function useDemoEvents() { return useDemoState().events }
export function useDemoAnalytics() { return useDemoState().analytics }
export function useDemoReviews() {
  const { reviewData, setReview, addSample, updateSample } = useDemoState()
  const reviewFor = (eventId: string) => reviewData.reviews[eventId] ?? 'pending'
  return { ...reviewData, reviewFor, setReview, addSample, updateSample }
}

export function useDemoSettings() {
  const { simulation, setRefresh, showEventTime, setShowEventTime } = useDemoState()
  return { refresh: simulation === 'running', setRefresh, showEventTime, setShowEventTime }
}

export function useSimulationStatus() {
  const { simulation, events } = useDemoState()
  return { simulation, latestSimulatedAt: events[0] === newestSeed ? null : events[0].occurredAt }
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

export function formatTime(occurredAt: string) {
  const date = new Date(occurredAt)
  return Number.isNaN(date.valueOf()) ? '—' : timeFormatter.format(date)
}
