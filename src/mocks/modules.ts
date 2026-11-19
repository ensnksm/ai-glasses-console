import type { FeatureId, ReviewState } from '../types'

export const moduleAnalytics = {
  environment: { calls: 328, failures: 6, elapsedMs: 393_600 },
  speech: { calls: 265, failures: 7, elapsedMs: 212_000 },
  sound: { calls: 174, failures: 5, elapsedMs: 104_400 },
  ocr: { calls: 193, failures: 3, elapsedMs: 193_000 },
  navigation: { calls: 142, failures: 7, elapsedMs: 56_800 },
  qa: { calls: 182, failures: 7, elapsedMs: 345_800 },
} satisfies Record<FeatureId, { calls: number; failures: number; elapsedMs: number }>

export const moduleTrends = [
  { time: '09:00', calls: 24, latency: 820 },
  { time: '10:00', calls: 47, latency: 760 },
  { time: '11:00', calls: 35, latency: 920 },
  { time: '12:00', calls: 64, latency: 850 },
  { time: '13:00', calls: 53, latency: 1180 },
  { time: '14:00', calls: 89, latency: 980 },
]

export type SampleEligibility = 'unchecked' | 'eligible' | 'excluded'

export interface DemoSample {
  id: string
  eventId: string
  eligibility: SampleEligibility
  correction: string
  tags: string
}

export const initialSamples: DemoSample[] = [
  { id: 'S-001', eventId: 'AI-1048', eligibility: 'unchecked', correction: '', tags: '室内' },
  { id: 'S-002', eventId: 'AI-1047', eligibility: 'eligible', correction: '', tags: '人工已核实' },
  { id: 'S-003', eventId: 'AI-1046', eligibility: 'eligible', correction: '设备检修区', tags: '标识文字 / 模拟修正' },
]

export const initialReviews: Partial<Record<string, ReviewState>> = {
  'AI-1047': 'correct', 'AI-1046': 'incorrect', 'AI-1045': 'reviewed',
  'AI-1041': 'reviewed', 'AI-1040': 'reviewed',
}

export const moduleDatasets = [
  { id: 'DS-01', name: '室内环境识别', featureId: 'environment', tags: '室内 / 普通光照', count: 428, approved: 412 },
  { id: 'DS-02', name: '复杂环境文字', featureId: 'ocr', tags: '低光照 / 模糊', count: 216, approved: 200 },
  { id: 'DS-03', name: '嘈杂环境语音', featureId: 'speech', tags: '噪声 / 多人', count: 375, approved: 354 },
  { id: 'DS-04', name: '交通声音事件', featureId: 'sound', tags: '室外 / 交通', count: 194, approved: 180 },
] satisfies { id: string; name: string; featureId: FeatureId; tags: string; count: number; approved: number }[]

export const moduleModels = [
  { name: 'Vision Service', version: 'v1.2', featureIds: ['environment', 'ocr'], probeMs: 1200, normal: true },
  { name: 'Speech Service', version: 'v2.0', featureIds: ['speech'], probeMs: 800, normal: true },
  { name: 'Sound Service', version: 'v1.1', featureIds: ['sound'], probeMs: 2400, normal: false },
  { name: 'LLM Service', version: 'v3.0', featureIds: ['qa'], probeMs: 1900, normal: true },
] satisfies { name: string; version: string; featureIds: FeatureId[]; probeMs: number; normal: boolean }[]
