import { useState } from 'react'
import {
  Activity,
  ArrowLeft,
  BatteryMedium,
  Brain,
  CircleAlert,
  ChevronRight,
  Clock3,
  Glasses,
  History,
  LockKeyhole,
  Radio,
  Video,
  Wifi,
} from 'lucide-react'
import {
  Badge,
  DeviceStatus,
  deviceSourceLabels,
  EmptyState,
  EventStatus,
  PageHeader,
  Panel,
} from '../../components/common/ui'
import CameraFeed from '../../components/monitoring/CameraFeed'
import { WorkspaceLink } from '../../components/workspace/workspaceContext'
import { devices, features, formatTime, useDemoEvents, useDemoSettings } from '../../services/demo'
import type { AIEvent, Device, FeatureId } from '../../types'
import './device-detail.css'

const featureById = new Map(features.map((feature) => [feature.id, feature]))

function FeatureMark({ featureId }: { featureId: FeatureId }) {
  const feature = featureById.get(featureId)
  const Icon = feature?.icon ?? Activity

  return (
    <span className={`detail-feature-icon detail-feature-icon--${feature?.tone ?? 'blue'}`}>
      <Icon size={17} aria-hidden="true" />
    </span>
  )
}

function EventTime({ event }: { event: AIEvent }) {
  return <time className="mono" dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time>
}

function DeviceOverview({ device, events }: { device: Device; events: AIEvent[] }) {
  const { showEventTime } = useDemoSettings()
  const [focus, setFocus] = useState<FeatureId | ''>('')
  const [historyView, setHistoryView] = useState<'all' | 'failed'>('all')
  const featuredEvent = focus ? events.find((event) => event.featureId === focus) : events[0]
  const history = historyView === 'failed' ? events.filter((event) => event.outcome === 'failed') : events
  const failureCount = events.filter((event) => event.outcome === 'failed').length

  return (
    <div className="page-stack device-detail">
      <PageHeader
        title={`设备详情 · ${device.id}`}
        description={`${device.name} · ${device.zone} · 模拟设备数据`}
        actions={
          <WorkspaceLink className="button button--quiet" to="/devices">
            <ArrowLeft size={16} aria-hidden="true" /> 返回设备管理
          </WorkspaceLink>
        }
      />

      <div className="detail-monitor-grid">
        <Panel
          title="摄像头画面"
          subtitle={`${device.id} · 设备摄像头`}
          icon={Video}
          action={<Badge tone="slate">未接入视频流</Badge>}
        >
          <CameraFeed device={device} />
        </Panel>

        <Panel
          title="AI 重点结果"
          subtitle="来自此设备的模拟 AI 事件"
          icon={Brain}
          action={
            <Badge tone={focus ? 'blue' : 'slate'} dot>
              {focus ? '功能已锁定' : '自动模式'}
            </Badge>
          }
        >
          <div className="detail-focus">
            <label className="detail-focus-control">
              <span>重点展示</span>
              <select
                className="field-select"
                value={focus}
                onChange={(event) => setFocus((event.target.value as FeatureId) || '')}
              >
                <option value="">自动 · 最新结果</option>
                {features.map((feature) => (
                  <option key={feature.id} value={feature.id}>{feature.name}</option>
                ))}
              </select>
            </label>

            {featuredEvent ? (
              <div className="detail-focus-result">
                <div className="detail-focus-meta">
                  <FeatureMark featureId={featuredEvent.featureId} />
                  <strong>{featureById.get(featuredEvent.featureId)?.name}</strong>
                  <EventStatus outcome={featuredEvent.outcome} />
                </div>
                <p>{featuredEvent.result}</p>
                <div className="detail-focus-footer">
                  {showEventTime && <span><Clock3 size={14} aria-hidden="true" /> <EventTime event={featuredEvent} /></span>}
                  <span>处理耗时 {featuredEvent.elapsedMs} ms</span>
                </div>
              </div>
            ) : (
              <EmptyState
                title={focus ? '暂无此功能的结果' : '暂无 AI 事件'}
                description={focus ? '收到该功能的新事件后，会在这里显示。' : '此设备目前没有模拟识别记录。'}
                icon={Brain}
              />
            )}

            <div className="detail-focus-hint">
              <p>
                {focus ? <LockKeyhole size={14} aria-hidden="true" /> : <Radio size={14} aria-hidden="true" />}
                {focus ? '仅更新该功能的重点结果，其他事件仍正常记录。' : '展示最新结果。选择一项功能即可锁定。'}
              </p>
              {focus && <button className="button button--quiet" type="button" onClick={() => setFocus('')}>解除锁定</button>}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="最近 AI 事件" subtitle="模拟事件 · 按发生时间倒序" icon={Activity}>
        {events.length > 0 ? (
          <ul className="detail-event-list">
            {events.slice(0, 4).map((event) => (
              <li key={event.id}>
                <WorkspaceLink className={`detail-event${showEventTime ? ' detail-event--timed' : ''}`} to={`/events?event=${encodeURIComponent(event.id)}`}>
                  <FeatureMark featureId={event.featureId} />
                  <div className="detail-event-copy">
                    <strong>{featureById.get(event.featureId)?.name}</strong>
                    <span>{event.result}</span>
                  </div>
                  <EventStatus outcome={event.outcome} />
                  {showEventTime && <EventTime event={event} />}
                  <ChevronRight className="detail-event-chevron" size={15} aria-hidden="true" />
                </WorkspaceLink>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="暂无近期事件" description="此设备暂无可展示的模拟 AI 事件。" icon={Activity} />
        )}
      </Panel>

      <Panel title="设备状态" subtitle="来自模拟设备的状态快照" icon={Glasses}>
        <dl className="detail-status-grid">
          <div><dt><Glasses size={16} aria-hidden="true" /> 设备编号</dt><dd className="mono">{device.id}</dd></div>
          <div><dt><Radio size={16} aria-hidden="true" /> 连接状态</dt><dd><DeviceStatus connection={device.connection} source={device.source} /></dd></div>
          <div><dt><Glasses size={16} aria-hidden="true" /> 数据来源</dt><dd>{deviceSourceLabels[device.source]}</dd></div>
          <div><dt><BatteryMedium size={16} aria-hidden="true" /> 剩余电量</dt><dd>{device.battery === null ? '—' : `${device.battery}%`}</dd></div>
          <div><dt><Wifi size={16} aria-hidden="true" /> 网络状态</dt><dd>{device.network}</dd></div>
          <div><dt><Clock3 size={16} aria-hidden="true" /> 运行时间</dt><dd>{device.uptime}</dd></div>
          <div><dt><History size={16} aria-hidden="true" /> 最后通信</dt><dd>{device.lastSeen && device.lastSeen !== '—' ? <time className="mono" dateTime={device.lastSeen}>{formatTime(device.lastSeen)}</time> : '—'}</dd></div>
        </dl>
      </Panel>

      <Panel
        title="历史运行记录"
        subtitle={`模拟 AI 调用 · ${events.length} 条记录 · ${failureCount} 条异常`}
        icon={History}
        action={
          <select
            aria-label="筛选历史运行记录"
            className="field-select"
            value={historyView}
            onChange={(event) => setHistoryView(event.target.value === 'failed' ? 'failed' : 'all')}
          >
            <option value="all">全部记录</option>
            <option value="failed">仅异常</option>
          </select>
        }
      >
        {history.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table detail-history-table">
              <thead><tr>
                <th scope="col">事件 ID</th>
                {showEventTime && <th scope="col">发生时间</th>}
                <th scope="col">AI 功能</th>
                <th scope="col">识别结果</th>
                <th scope="col">耗时</th>
                <th scope="col">请求状态</th>
              </tr></thead>
              <tbody>
                {history.map((event) => (
                  <tr key={event.id}>
                    <td className="mono">{event.id}</td>
                    {showEventTime && <td><EventTime event={event} /></td>}
                    <td>{featureById.get(event.featureId)?.name}</td>
                    <td className="detail-history-result">{event.result}</td>
                    <td className="mono">{event.elapsedMs} ms</td>
                    <td><EventStatus outcome={event.outcome} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={historyView === 'failed' ? '暂无异常记录' : '暂无历史记录'}
            description={historyView === 'failed' ? '当前模拟记录中没有失败的调用。' : '此设备还没有模拟调用记录。'}
            icon={History}
          />
        )}
      </Panel>
    </div>
  )
}

export default function DeviceDetail({ deviceId }: { deviceId: string }) {
  const events = useDemoEvents()
  const device = devices.find((item) => item.id === deviceId)

  if (!device) {
    return (
      <div className="page-stack device-detail">
        <PageHeader title="设备详情" description="查看摄像头状态、AI 识别结果和历史运行记录。" />
        <Panel>
          <EmptyState
            title="找不到该设备"
            description="此设备编号不在当前演示设备列表中。"
            icon={CircleAlert}
            action={<WorkspaceLink className="button" to="/devices"><ArrowLeft size={16} aria-hidden="true" /> 返回设备管理</WorkspaceLink>}
          />
        </Panel>
      </div>
    )
  }

  return <DeviceOverview key={device.id} device={device} events={events.filter((event) => event.deviceId === device.id)} />
}
