import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, CircleDashed, Pause } from 'lucide-react'
import type { AIEvent, AssistKind } from '../../types'
import GlassSegmentedControl from '../../components/common/GlassSegmentedControl'
import { DeviceStatus, EventStatus } from '../../components/common/ui'
import CameraFeed from '../../components/monitoring/CameraFeed'
import { WorkspaceLink, useWindow } from '../../components/workspace/workspaceContext'
import { useAuth } from '../../services/auth'
import { assistKinds, devices, features, formatTime, totalCalls, useDemoAnalytics, useDemoEvents, useDemoReviews, useDemoSettings, useSimulationStatus } from '../../services/demo'
import './monitor-optics.css'

const videoLayouts = [
  { value: 'single', label: '单画面' },
  { value: 'grid', label: '四宫格' },
] as const

const simulationLabels = {
  idle: { icon: CircleDashed, text: '模拟未启动' },
  running: { icon: Activity, text: '模拟事件更新中' },
  paused: { icon: Pause, text: '模拟已暂停' },
}

function SimulationStatus({ showEventTime }: { showEventTime: boolean }) {
  const { simulation, latestSimulatedAt } = useSimulationStatus()
  const { icon: Icon, text } = simulationLabels[simulation]
  return (
    <div className={`monitor-live monitor-live--${simulation}`} role="status">
      <Icon size={14} aria-hidden="true" />
      <span>{text}{simulation === 'paused' && (
        latestSimulatedAt ? showEventTime && <> · 数据停在 <time dateTime={latestSimulatedAt} title="最后一条模拟事件的时间（北京时间）">{formatTime(latestSimulatedAt).slice(0, 5)}</time></> : ' · 尚未产生新事件'
      )}</span>
    </div>
  )
}

function useLiveResultHighlight(deviceId: string, resultId: string | undefined, incomingId: string | undefined, running: boolean) {
  const { scrollRef, visible } = useWindow()
  const edge = useRef<HTMLDivElement>(null)
  const previous = useRef({ deviceId, resultId })

  useEffect(() => {
    const last = previous.current
    previous.current = { deviceId, resultId }
    // The latest global event must also be new to this unchanged selection.
    if (!running || !visible || !resultId || resultId !== incomingId || deviceId !== last.deviceId || resultId === last.resultId) return

    const element = edge.current
    const motionAllowed = window.matchMedia('(prefers-reduced-motion: no-preference) and (forced-colors: none)')
    if (!element || document.hidden || !motionAllowed.matches) return

    function onVisibilityChange() { if (document.hidden) stop() }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || document.hidden || !motionAllowed.matches) stop()
      else element.classList.add('is-arriving')
    }, { root: scrollRef.current })
    function stop() {
      observer.disconnect()
      element?.classList.remove('is-arriving')
      element?.removeEventListener('animationend', stop)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      motionAllowed.removeEventListener('change', stop)
    }

    element.addEventListener('animationend', stop, { once: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    motionAllowed.addEventListener('change', stop)
    observer.observe(element)
    return stop
  }, [deviceId, resultId, incomingId, running, visible, scrollRef])

  return edge
}

const featureOf = (id?: AIEvent['featureId']) => features.find((feature) => feature.id === id)
const assistOrder: AssistKind[] = ['vision', 'hearing']

export default function MonitorPage() {
  const [deviceId, setDeviceId] = useState(devices[0].id)
  const [layout, setLayout] = useState<'single' | 'grid'>('single')
  const events = useDemoEvents()
  const { calls } = totalCalls(useDemoAnalytics())
  const { samples, reviewFor } = useDemoReviews()
  const canViewSamples = useAuth().can('viewSamples')
  const pendingSamples = canViewSamples ? samples.filter((sample) => ['pending', 'conflict'].includes(reviewFor(sample.eventId))).length : '—'
  const { refresh, showEventTime } = useDemoSettings()
  const selected = devices.find((device) => device.id === deviceId) ?? devices[0]
  const selectedEvents = events.filter((event) => event.deviceId === selected.id)
  const latest = selectedEvents[0]
  const resultHighlight = useLiveResultHighlight(selected.id, latest?.id, events[0]?.id, refresh)
  const currentFeature = featureOf(latest?.featureId)
  const latestByAssist = assistOrder.map((kind) => ({ kind, event: selectedEvents.find((event) => featureOf(event.featureId)?.assist === kind) }))
  const summary = [
    { label: '台设备', value: devices.length },
    { label: '台模拟在线', value: devices.filter((device) => device.connection === 'online').length },
    { label: '次 AI 调用', value: calls.toLocaleString('zh-CN') },
    { label: '个待审样本', value: pendingSamples },
  ]

  return (
    <div className="page-stack monitor-page">
      <header className="monitor-header">
        <div>
          <h1>实时监控</h1>
          <p className="visually-hidden">查看眼镜画面状态，以及 AI 为视障、听障佩戴者生成的感知结果。</p>
          <dl className="monitor-summary" aria-label="模拟设备概览">
            {summary.map(({ label, value }) => <div key={label}><dd>{value}</dd><dt>{label}</dt></div>)}
          </dl>
        </div>
        <SimulationStatus showEventTime={showEventTime} />
      </header>

      <div className="monitor-toolbar">
        <div className="device-selector" role="group" aria-label="选择监控设备">
          {devices.map((device) => (
            <button className="device-choice" type="button" aria-pressed={device.id === selected.id} onClick={() => setDeviceId(device.id)} key={device.id}>
              <span className={`status-dot status-dot--${device.connection}`} aria-hidden="true" />
              <span className="device-choice__id">{device.id}</span>
              <DeviceStatus connection={device.connection} source={device.source} />
            </button>
          ))}
        </div>
        <GlassSegmentedControl label="视频布局" options={videoLayouts} value={layout} onChange={setLayout} />
      </div>

      <div className="monitor-grid">
        <section className="monitor-main" aria-label="实时画面">
          {layout === 'single' ? <CameraFeed device={selected} overlay={
            <div className="camera-ai-caption" role="group" aria-label="所选设备的最新 AI 输出">
              <div ref={resultHighlight} className="monitor-result-edge" aria-hidden="true" />
              <span className="camera-ai-caption__meta">
                <span>{currentFeature ? `${currentFeature.name} · ${assistKinds[currentFeature.assist].label}` : '暂无 AI 输出'}</span>
                {latest && showEventTime && <time dateTime={latest.occurredAt}>{formatTime(latest.occurredAt).slice(0, 5)}</time>}
                <span className="camera-ai-caption__tag">模拟</span>
              </span>
              <strong>{latest?.result ?? '等待模拟事件'}</strong>
            </div>
          } /> : (
            <div className="camera-grid" aria-label="四宫格视频">
              {devices.map((device) => {
                const deviceLatest = events.find((event) => event.deviceId === device.id)
                return <button type="button" key={device.id} className="camera-tile" aria-pressed={device.id === selected.id} aria-label={`选择 ${device.id}`} onClick={() => setDeviceId(device.id)}>
                  <CameraFeed device={device} compact overlay={<span className="camera-ai-caption camera-ai-caption--compact">{deviceLatest?.result ?? '暂无 AI 输出'}</span>} />
                </button>
              })}
              <CameraFeed compact />
            </div>
          )}
          <div className="camera-controls">
            <div><span className="camera-controls-name">{selected.name}</span><span className="muted">{selected.zone}</span></div>
            <WorkspaceLink className="button button--quiet" to={`/devices/${encodeURIComponent(selected.id)}`}>设备详情 <ArrowRight size={14} /></WorkspaceLink>
          </div>
        </section>

        <aside className="perception" aria-labelledby="perception-title">
          <h2 className="section-title" id="perception-title">AI 感知</h2>
          <div className="assist-list">
            {latestByAssist.map(({ kind, event }) => {
              const { label, audience } = assistKinds[kind]
              const feature = featureOf(event?.featureId)
              return <div className={`assist-row assist-row--${kind}`} key={kind}>
                <span className="assist-row__label"><span className="assist-dot" aria-hidden="true" />{label}<small>{audience}</small></span>
                <strong>{event?.result ?? '暂无该类结果'}</strong>
                {event && <span className="assist-row__meta">{feature?.name}{showEventTime && <> · <time dateTime={event.occurredAt}>{formatTime(event.occurredAt).slice(0, 5)}</time></>}</span>}
              </div>
            })}
          </div>
          <h3 className="section-title section-title--small">最近事件</h3>
          <div className="event-list">
            {selectedEvents.slice(0, 4).map((event) => {
              const feature = featureOf(event.featureId)
              return <WorkspaceLink to={`/events?event=${encodeURIComponent(event.id)}`} key={event.id} className={`event-peek${event.outcome === 'failed' ? ' event-peek--failed' : ''}`} title={event.result}>
                <span className="event-peek__text"><span className="event-peek__result">{event.result}</span><span className="event-peek__feature">{feature?.name}{event.outcome === 'failed' ? ' · 失败' : ''}</span></span>
                {showEventTime && <time dateTime={event.occurredAt}>{formatTime(event.occurredAt).slice(0, 5)}</time>}
              </WorkspaceLink>
            })}
            {!selectedEvents.length && <p className="event-list-empty muted">该设备暂无 AI 事件。</p>}
          </div>
        </aside>
      </div>

      <section className="records-section" aria-labelledby="records-title">
        <div className="section-heading">
          <h2 className="section-title" id="records-title">最近运行记录</h2>
          <WorkspaceLink className="button button--quiet" to="/events">查看全部 <ArrowRight size={14} /></WorkspaceLink>
        </div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th scope="col">设备</th><th scope="col">AI 功能</th><th scope="col">识别结果</th><th scope="col">请求状态</th>{showEventTime && <th scope="col">发生时间</th>}</tr></thead>
          <tbody>{events.slice(0, 5).map((event) => (
            <tr key={event.id}><td><WorkspaceLink className="table-link mono" to={`/devices/${encodeURIComponent(event.deviceId)}`}>{event.deviceId}</WorkspaceLink></td><td>{features.find((feature) => feature.id === event.featureId)?.name}</td><td><WorkspaceLink className="table-result" to={`/events?event=${encodeURIComponent(event.id)}`}>{event.result}</WorkspaceLink></td><td><EventStatus outcome={event.outcome} /></td>{showEventTime && <td className="mono muted">{formatTime(event.occurredAt)}</td>}</tr>
          ))}</tbody>
        </table></div>
      </section>
    </div>
  )
}
