import { AudioLines, BrainCircuit, Compass, Ear, Eye, ScanEye, ScanText, Speech } from 'lucide-react'
import type { AIEvent, AssistKind, Device, Feature } from '../types'

export const devices: Device[] = [
  { id: 'GL-001', name: '演示眼镜 A', zone: '室内识别区', connection: 'online', source: 'mock', battery: 82, network: 'Wi-Fi · 良好', uptime: '3 小时 24 分', lastSeen: '2026-11-13T14:32:18+08:00' },
  { id: 'GL-002', name: '演示眼镜 B', zone: '移动测试区', connection: 'offline', source: 'mock', battery: null, network: '未连接', uptime: '—', lastSeen: '2026-11-13T13:58:02+08:00' },
  { id: 'GL-003', name: '演示眼镜 C', zone: '功能验证区', connection: 'unknown', source: 'mock', battery: 95, network: '模拟链路', uptime: '1 小时 08 分', lastSeen: '2026-11-13T14:31:08+08:00' },
]

export const features: Feature[] = [
  { id: 'environment', name: '环境识别', icon: ScanEye, tone: 'blue', assist: 'vision' },
  { id: 'speech', name: '语音转文字', icon: Speech, tone: 'violet', assist: 'hearing' },
  { id: 'sound', name: '环境声音识别', icon: AudioLines, tone: 'teal', assist: 'hearing' },
  { id: 'ocr', name: 'OCR 文字识别', icon: ScanText, tone: 'amber', assist: 'vision' },
  { id: 'navigation', name: '导航定位', icon: Compass, tone: 'teal', assist: 'vision' },
  { id: 'qa', name: 'AI 智能问答', icon: BrainCircuit, tone: 'violet', assist: 'vision' },
]

export const assistKinds: Record<AssistKind, { label: string; audience: string; icon: typeof Eye }> = {
  vision: { label: '视觉辅助', audience: '面向视障佩戴者', icon: Eye },
  hearing: { label: '听觉辅助', audience: '面向听障佩戴者', icon: Ear },
}

const evidence = '模拟事件，仅提供文本证据；无真实媒体。'

export const seedEvents: AIEvent[] = [
  { id: 'AI-1048', deviceId: 'GL-001', featureId: 'environment', occurredAt: '2026-11-13T14:32:18+08:00', result: '识别到桌子和水杯', elapsedMs: 248, outcome: 'success', evidence },
  { id: 'AI-1047', deviceId: 'GL-001', featureId: 'speech', occurredAt: '2026-11-13T14:31:46+08:00', result: '转写：请从右侧入口进入。', elapsedMs: 382, outcome: 'success', evidence },
  { id: 'AI-1046', deviceId: 'GL-003', featureId: 'ocr', occurredAt: '2026-11-13T14:31:08+08:00', result: '读取文本：设备调试区', elapsedMs: 294, outcome: 'success', evidence },
  { id: 'AI-1045', deviceId: 'GL-001', featureId: 'sound', occurredAt: '2026-11-13T14:30:21+08:00', result: '检测到门铃声', elapsedMs: 173, outcome: 'success', evidence },
  { id: 'AI-1044', deviceId: 'GL-001', featureId: 'navigation', occurredAt: '2026-11-13T14:28:04+08:00', result: '模拟定位超时，未返回结果', elapsedMs: 1500, outcome: 'failed', evidence },
  { id: 'AI-1043', deviceId: 'GL-003', featureId: 'qa', occurredAt: '2026-11-13T14:27:36+08:00', result: '前方约三步处是门口。', elapsedMs: 468, outcome: 'success', evidence },
  { id: 'AI-1042', deviceId: 'GL-001', featureId: 'ocr', occurredAt: '2026-11-13T14:26:19+08:00', result: '读取文本：向右通行', elapsedMs: 311, outcome: 'success', evidence },
  { id: 'AI-1041', deviceId: 'GL-002', featureId: 'environment', occurredAt: '2026-11-13T13:58:02+08:00', result: '模拟链路已断开', elapsedMs: 1200, outcome: 'failed', evidence },
  { id: 'AI-1040', deviceId: 'GL-002', featureId: 'speech', occurredAt: '2026-11-13T13:52:02+08:00', result: '转写：已到达测试区。', elapsedMs: 274, outcome: 'success', evidence },
]

export const demoReadings: Array<Pick<AIEvent, 'deviceId' | 'featureId' | 'result' | 'elapsedMs'>> = [
  { deviceId: 'GL-001', featureId: 'environment', result: '识别到前方有一把椅子', elapsedMs: 254 },
  { deviceId: 'GL-001', featureId: 'speech', result: '转写：前方通道可以通行。', elapsedMs: 318 },
  { deviceId: 'GL-003', featureId: 'sound', result: '检测到室内广播声', elapsedMs: 182 },
  { deviceId: 'GL-001', featureId: 'ocr', result: '读取文本：无障碍入口', elapsedMs: 301 },
  { deviceId: 'GL-001', featureId: 'navigation', result: '模拟路线：直行至走廊尽头', elapsedMs: 330 },
  { deviceId: 'GL-003', featureId: 'qa', result: '右侧是休息区。', elapsedMs: 416 },
  { deviceId: 'GL-001', featureId: 'sound', result: '检测到脚步声', elapsedMs: 187 },
  { deviceId: 'GL-001', featureId: 'qa', result: '左前方有一个空座位。', elapsedMs: 425 },
]

