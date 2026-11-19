import type { LucideIcon } from 'lucide-react'

export type DeviceConnection = 'online' | 'offline' | 'unknown'
export type DeviceSource = 'mock' | 'hardware'
export type FeatureId = 'environment' | 'speech' | 'sound' | 'ocr' | 'navigation' | 'qa'
/** Which wearer group a feature mainly serves: visually impaired or hearing impaired. */
export type AssistKind = 'vision' | 'hearing'
export type ReviewDecision = 'pending' | 'correct' | 'incorrect'
export type ReviewState = ReviewDecision | 'reviewed' | 'conflict'

export interface Device {
  id: string
  name: string
  zone: string
  connection: DeviceConnection
  source: DeviceSource
  battery: number | null
  network: string
  uptime: string
  lastSeen: string
}

export interface Feature {
  id: FeatureId
  name: string
  icon: LucideIcon
  tone: 'blue' | 'violet' | 'teal' | 'amber'
  assist: AssistKind
}

export interface AIEvent {
  id: string
  deviceId: string
  featureId: FeatureId
  occurredAt: string
  result: string
  elapsedMs: number
  outcome: 'success' | 'failed'
  evidence: string
}
