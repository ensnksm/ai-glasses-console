import { initialReviews, initialSamples } from '../mocks/modules'
import type { DemoSample } from '../mocks/modules'
import type { AIEvent, ReviewDecision, ReviewState } from '../types'

const key = 'aig-demo-review-v2'

export interface DemoReviewData {
  samples: DemoSample[]
  reviews: Partial<Record<string, ReviewState>>
  snapshots: Record<string, AIEvent>
}

function readSessionData<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch { return fallback }
}

export function readDemoReviews(): DemoReviewData {
  const saved = readSessionData<DemoReviewData | null>(key, null)
  if (saved) return saved

  const oldSamples = readSessionData<(DemoSample & { decision: ReviewDecision })[] | null>('aig-demo-samples-v1', null)
  const oldReviews = readSessionData<Partial<Record<string, ReviewDecision>>>('aig-demo-event-reviews-v1', {})
  const snapshots = readSessionData<Record<string, AIEvent>>('aig-demo-event-snapshots-v1', {})
  const reviews: DemoReviewData['reviews'] = { ...initialReviews, ...oldReviews }
  const samples = oldSamples?.map(({ decision, ...sample }) => {
    const seed = initialSamples.find((item) => item.eventId === sample.eventId)
    const defaultDecision = seed ? initialReviews[seed.eventId] ?? 'pending' : 'pending'
    const eventReview = oldReviews[sample.eventId]
    // Only flag conflicting edits; a legacy sample's unchanged default is not an edit.
    if (decision !== defaultDecision) {
      reviews[sample.eventId] = eventReview && decision !== eventReview ? 'conflict' : decision
    }
    return sample
  }) ?? initialSamples
  return { samples, reviews, snapshots }
}

export function saveDemoReviews(value: DemoReviewData) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* The current tab still works without storage. */ }
}
