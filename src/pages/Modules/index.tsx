import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  Activity, ArrowDownWideNarrow, ArrowLeft, ArrowRight, AudioLines, BrainCircuit, ChartNoAxesCombined,
  CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, Clock3, Database, Download, FileText,
  HardDrive, LayoutDashboard, Network, Plus, Search, ShieldCheck,
} from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, EmptyState, EventStatus, MetricCard, PageHeader, Panel } from '../../components/common/ui'
import ThemeControl from '../../components/common/ThemeControl'
import TransparencyControl from '../../components/common/TransparencyControl'
import { useThemePreference } from '../../services/theme'
import SearchInput from '../../components/common/SearchInput'
import GlassSegmentedControl from '../../components/common/GlassSegmentedControl'
import { WorkspaceLink, useWindow } from '../../components/workspace/workspaceContext'
import { moduleDatasets, moduleModels, moduleTrends, type DemoSample, type SampleEligibility } from '../../mocks/modules'
import { useAuth } from '../../services/auth'
import { devices, features, formatTime, seedEvents, totalCalls, useDemoAnalytics, useDemoEvents, useDemoReviews, useDemoSettings } from '../../services/demo'
import { chartAnimationMs } from '../../services/motion'
import type { AIEvent, ReviewDecision, ReviewState } from '../../types'
import Switch from './Switch'
import './modules.css'

const number = new Intl.NumberFormat('zh-CN')
const reviewLabels = { pending: '待审核', correct: '识别正确', incorrect: '识别错误', reviewed: '已审核（结论未记录）', conflict: '结论待核对' } as const
const reviewTones = { pending: 'amber', correct: 'green', incorrect: 'red', reviewed: 'slate', conflict: 'amber' } as const
const sampleOptions = [
  ['unchecked', '待定'], ['eligible', '可收录'], ['excluded', '不收录'],
] as const
const decisionOptions = ['pending', 'correct', 'incorrect'] as const
const reviewSegments = decisionOptions.map((value) => ({ value, label: reviewLabels[value] }))
const reviewOptions = ['pending', 'correct', 'incorrect', 'reviewed', 'conflict'] as const
const featureName = (id: AIEvent['featureId']) => features.find((feature) => feature.id === id)?.name ?? id

function ModulePage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="page-stack module-page"><PageHeader title={title} description={description} />{children}</div>
}

function Table({ headings, children }: { headings: string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Trend({ mode }: { mode: 'calls' | 'latency' }) {
  const areaId = useId()
  const isCalls = mode === 'calls'
  const caption = isCalls ? 'AI 请求量' : '平均响应耗时'
  const unit = isCalls ? ' 次' : ' ms'
  return (
    <div className="module-trend" role="group" aria-label={`模拟${caption}：${moduleTrends.map(({ time, ...point }) => `${time} ${point[mode]}${unit}`).join('，')}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 260 }}>
        <ComposedChart data={moduleTrends} margin={{ top: 12, right: 22, left: 0, bottom: 0 }}>
          <defs><linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.26} />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0.03} />
          </linearGradient></defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="4 4" />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={12} tick={{ fill: 'var(--chart-tick)', fontSize: 12 }} />
          <YAxis width={isCalls ? 36 : 58} domain={isCalls ? [0, 100] : [600, 1400]} tickFormatter={(value: number) => isCalls ? String(value) : `${value}ms`} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-tick)', fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}${unit}`, caption]}
            contentStyle={{ background: 'var(--surface-raised)', borderColor: 'var(--line-strong)', borderRadius: 'var(--radius-inner)', color: 'var(--ink)', boxShadow: 'var(--shadow-panel)' }}
            labelStyle={{ color: 'var(--muted)' }} itemStyle={{ color: 'var(--ink)' }} cursor={{ stroke: 'var(--chart-grid)' }} />
          <Area type="monotone" dataKey={mode} baseValue={isCalls ? 0 : 600} stroke="none" fill={`url(#${areaId})`} fillOpacity={1} tooltipType="none" isAnimationActive={false} activeDot={false} />
          <Line type="monotone" dataKey={mode} stroke="var(--chart-line)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--chart-line)', stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={chartAnimationMs} animationEasing="ease-out" isAnimationActive="auto" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AnalyticsPage() {
  const analytics = useDemoAnalytics()
  const totals = totalCalls(analytics)
  return (
    <ModulePage title="AI 运行分析" description="查看六项 AI 功能的调用量、成功率与处理耗时。">
      <div className="metrics-grid">
        <MetricCard label="AI 总调用量" value={number.format(totals.calls)} icon={Activity} caption="模拟基线及本轮新增" highlightChanges />
        <MetricCard label="任务成功率" value={`${((1 - totals.failures / totals.calls) * 100).toFixed(1)}%`} icon={CheckCircle2} caption="成功调用 / 总调用" />
        <MetricCard label="平均处理耗时" value={`${(totals.elapsedMs / totals.calls / 1000).toFixed(2)} s`} icon={Clock3} caption="业务调用 · 按调用量加权" />
        <MetricCard label="失败请求" value={totals.failures} icon={CircleAlert} caption="模拟基线及本轮新增" />
      </div>
      <Panel title="AI 请求趋势" subtitle="历史演示日的小时抽样，不含本轮新增" icon={ChartNoAxesCombined} action={<Badge>模拟数据</Badge>}>
        <Trend mode="calls" />
      </Panel>
      <Panel title="六项 AI 功能运行概览" subtitle="按业务调用统计，与模型服务的单次探测分开计算。" icon={BrainCircuit}>
        <Table headings={['AI 功能', '调用量', '成功率', '失败数', '平均耗时']}>
          {features.map(({ id, name }) => {
            const item = analytics[id]
            return <tr key={id}><th scope="row">{name}</th><td>{number.format(item.calls)}</td>
              <td>{((1 - item.failures / item.calls) * 100).toFixed(1)}%</td><td>{item.failures}</td><td>{(item.elapsedMs / item.calls / 1000).toFixed(1)} s</td>
            </tr>
          })}
        </Table>
      </Panel>
    </ModulePage>
  )
}

function ReviewBadge({ decision }: { decision: ReviewState }) {
  return <Badge tone={reviewTones[decision]} dot feedbackKey={decision}>{reviewLabels[decision]}</Badge>
}

function ReviewField({ label, value, onChange }: { label: string; value: ReviewState; onChange: (decision: ReviewDecision) => void }) {
  return <SelectField label={label} value={value} onChange={(next) => {
    const decision = decisionOptions.find((item) => item === next)
    if (decision) onChange(decision)
  }}>
    {(value === 'reviewed' || value === 'conflict') && <option value={value} disabled>{reviewLabels[value]}</option>}
    {decisionOptions.map((decision) => <option key={decision} value={decision}>{reviewLabels[decision]}</option>)}
  </SelectField>
}

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: ReactNode
}) {
  return <select className="field-select" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
}

export function EventsPage() {
  const events = useDemoEvents()
  const { showEventTime } = useDemoSettings()
  const { reviewFor } = useDemoReviews()
  const [query, setQuery] = useState('')
  const [device, setDevice] = useState('')
  const [feature, setFeature] = useState('')
  const [reviewFilter, setReviewFilter] = useState('')
  const [descending, setDescending] = useState(true)
  const matches = events.filter((event) =>
    (!device || event.deviceId === device)
    && (!feature || event.featureId === feature)
    && (!reviewFilter || reviewFor(event.id) === reviewFilter)
    && (!query.trim() || `${event.id} ${event.deviceId} ${featureName(event.featureId)}`.toLowerCase().includes(query.trim().toLowerCase())),
  )
  if (!descending) matches.reverse()
  return (
    <ModulePage title="AI 事件中心" description="查找模拟识别记录，追溯原始结果和人工审核结论。">
      <Panel title="AI 历史事件" subtitle={`共 ${matches.length} 条匹配记录`} icon={FileText} action={<Badge>模拟数据</Badge>}>
        <div className="module-filters">
          <SearchInput className="module-search" label="搜索事件编号或设备" value={query} onChange={setQuery} />
          <SelectField label="筛选设备" value={device} onChange={setDevice}>
            <option value="">全部设备</option>{devices.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
          </SelectField>
          <SelectField label="筛选 AI 功能" value={feature} onChange={setFeature}>
            <option value="">全部 AI 功能</option>{features.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </SelectField>
          <SelectField label="筛选审核状态" value={reviewFilter} onChange={setReviewFilter}>
            <option value="">全部审核状态</option>{reviewOptions.map((option) => <option key={option} value={option}>{reviewLabels[option]}</option>)}
          </SelectField>
          <button className="button button--quiet" type="button" onClick={() => setDescending(!descending)}><ArrowDownWideNarrow size={16} />{descending ? '最新优先' : '最早优先'}</button>
        </div>
        {matches.length ? (
          <Table headings={['事件 ID', '设备', 'AI 功能', ...(showEventTime ? ['发生时间'] : []), '请求状态', '审核状态', '操作']}>
            {matches.map((event) => {
              const decision = reviewFor(event.id)
              return <tr key={event.id}>
                <th scope="row" className="mono">{event.id}</th><td className="mono">{event.deviceId}</td><td>{featureName(event.featureId)}</td>
                {showEventTime && <td className="mono muted">{formatTime(event.occurredAt)}</td>}
                <td><EventStatus outcome={event.outcome} /></td>
                <td><ReviewBadge decision={decision} /></td>
                <td><WorkspaceLink className="module-text-button" to={`/events?event=${encodeURIComponent(event.id)}`} aria-label={`查看事件 ${event.id}`}>详情 <ChevronRight size={15} /></WorkspaceLink></td>
              </tr>
            })}
          </Table>
        ) : <EmptyState title="没有匹配的事件" description="试试其他关键词或清除筛选。" icon={Search} />}
      </Panel>
    </ModulePage>
  )
}

export function EventDetailPage({ eventId }: { eventId: string }) {
  const events = useDemoEvents()
  const { can } = useAuth()
  const { showEventTime } = useDemoSettings()
  const { samples, snapshots, reviewFor, setReview, addSample } = useDemoReviews()
  const current = events.find((event) => event.id === eventId) ?? seedEvents.find((event) => event.id === eventId) ?? snapshots[eventId]
  // Keep a viewed event in this window when the finite live list rotates. Viewing alone never writes to the shared sample store.
  const [retained, setRetained] = useState(current)
  useEffect(() => { if (current) setRetained(current) }, [current])
  const event = current ?? (retained?.id === eventId ? retained : undefined)
  const canViewSamples = can('viewSamples')
  const queuedSample = canViewSamples && event ? samples.find((sample) => sample.eventId === event.id) : undefined
  const review = event ? reviewFor(event.id) : 'pending'

  return (
    <ModulePage title={`事件详情 · ${eventId}`} description="查看这条模拟记录的证据、原始结果及人工审核。">
      {!event ? <Panel>
        <EmptyState title="没有找到该事件" description="此记录可能已离开当前演示列表。" icon={FileText}
          action={<WorkspaceLink className="button" to="/events">打开 AI 事件中心 <ArrowRight size={15} /></WorkspaceLink>} />
      </Panel> : <>
        <Panel title="基础信息" icon={FileText} action={<Badge>模拟记录</Badge>}>
          <dl className="module-facts">
            <div><dt>设备</dt><dd><WorkspaceLink className="table-link mono" to={`/devices/${encodeURIComponent(event.deviceId)}`}>{event.deviceId}</WorkspaceLink></dd></div>
            <div><dt>AI 功能</dt><dd>{featureName(event.featureId)}</dd></div>
            {showEventTime && <div><dt>发生时间</dt><dd><time className="mono" dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></dd></div>}
            <div><dt>处理耗时</dt><dd>{number.format(event.elapsedMs)} ms</dd></div>
            <div><dt>请求状态</dt><dd><EventStatus outcome={event.outcome} /></dd></div>
          </dl>
        </Panel>
        <div className="module-split">
          <Panel title="关联证据"><div className="module-evidence event-detail-evidence"><FileText aria-hidden="true" size={24} /><span>{event.evidence || '没有保存关联证据。'}</span></div></Panel>
          <Panel title="AI 原始结果"><div className="module-original"><strong>{event.result}</strong></div></Panel>
        </div>
        <Panel title="人工审核" icon={ClipboardCheck}>
          <div className="module-inline">
            {can('reviewResults') ? <ReviewField label="事件审核结论" value={review} onChange={(value) => setReview(event, value)} /> :
              <><ReviewBadge decision={review} /><span className="module-access-note">当前账号只能查看审核结论。</span></>}
          </div>
          {review === 'conflict' && <p className="event-detail-copy">旧版事件和样本结论不同，需有识别审核权限的账号重新确认。</p>}
        </Panel>
        <Panel title="候选样本">
          {!canViewSamples ? <p className="event-detail-copy">当前账号没有候选样本查看权限。</p> :
            queuedSample ? <WorkspaceLink className="module-text-button" to={`/samples?sample=${encodeURIComponent(queuedSample.id)}`}>查看候选样本 {queuedSample.id} <ChevronRight size={15} /></WorkspaceLink> :
            can('addSamples') ? <button type="button" className="button button--primary button--sheen" onClick={() => addSample(event)}><Plus size={16} />加入候选样本库</button> :
            <p className="event-detail-copy">此事件尚未加入候选样本库。当前账号无添加权限。</p>}
        </Panel>
      </>}
    </ModulePage>
  )
}

function SampleFieldValue({ label, children }: { label: string; children: ReactNode }) {
  return <div className="module-sample-value"><span>{label}</span><div>{children}</div></div>
}

export function SamplesPage() {
  const { samples, snapshots, reviewFor, setReview, updateSample } = useDemoReviews()
  const { can } = useAuth()
  const canReview = can('reviewResults')
  const canEditSample = can('editSamples')
  const sampleAction = canReview || canEditSample ? '审阅' : '查看'
  const [feature, setFeature] = useState('')
  const [decision, setDecision] = useState('')
  const [filterReset, setFilterReset] = useState(false)
  const { search, setSearch, scrollRef, visible } = useWindow()
  const workspace = useRef<HTMLDivElement>(null)
  const handledRequest = useRef<string | null>(null)
  const scrolledRequest = useRef<string | null>(null)
  const findEvent = (id: string) => seedEvents.find((event) => event.id === id) ?? snapshots[id]
  const matchesFilters = (sample: DemoSample, nextFeature: string, nextDecision: string) =>
    (!nextFeature || findEvent(sample.eventId)?.featureId === nextFeature) && (!nextDecision || reviewFor(sample.eventId) === nextDecision)
  const filtered = samples.filter((sample) => matchesFilters(sample, feature, decision))
  const requestedId = new URLSearchParams(search).get('sample')
  const requested = samples.find((sample) => sample.id === requestedId)
  const current = requestedId ? requested : filtered[0]
  const activeEvent = current && findEvent(current.eventId)
  const currentIndex = filtered.findIndex((sample) => sample.id === current?.id)
  const resetFeature = Boolean(requested && feature && findEvent(requested.eventId)?.featureId !== feature)
  const resetDecision = Boolean(requested && decision && reviewFor(requested.eventId) !== decision)
  function scrollToReview() {
    const container = scrollRef.current
    const target = workspace.current
    if (!container || !target) return false
    container.scrollTo({ top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 9, behavior: 'instant' })
    return true
  }
  useEffect(() => {
    if (requestedId !== handledRequest.current) {
      handledRequest.current = requestedId
      scrolledRequest.current = null
      if (resetFeature) setFeature('')
      if (resetDecision) setDecision('')
      setFilterReset(resetFeature || resetDecision)
      if (resetFeature || resetDecision) return
    }
    if (visible && requested && scrolledRequest.current !== requestedId && scrollToReview()) scrolledRequest.current = requestedId
  })
  function choose(id: string | null) {
    if (id === requestedId) {
      if (id) scrollToReview()
      return
    }
    const params = new URLSearchParams(search)
    if (id) params.set('sample', id)
    else params.delete('sample')
    setSearch(params)
  }
  function applyFilters(nextFeature: string, nextDecision: string) {
    setFeature(nextFeature)
    setDecision(nextDecision)
    setFilterReset(false)
    if (requested && !matchesFilters(requested, nextFeature, nextDecision)) choose(null)
  }
  const update = (patch: Partial<Pick<DemoSample, 'correction' | 'tags' | 'eligibility'>>) => {
    if (current && canEditSample) updateSample(current.id, patch)
  }
  return (
    <ModulePage title="样本审核" description="查看候选数据、对照识别结果和独立记录的收录资格。">
      <div className="metrics-grid module-metrics-three">
        <MetricCard label="候选样本" value={samples.length} icon={ClipboardCheck} />
        <MetricCard label="待审核样本" value={samples.filter((sample) => ['pending', 'conflict'].includes(reviewFor(sample.eventId))).length} icon={Clock3} />
        <MetricCard label="识别错误" value={samples.filter((sample) => reviewFor(sample.eventId) === 'incorrect').length} icon={CircleAlert} />
      </div>
      <Panel title="候选样本表格" icon={ClipboardCheck} action={<Badge>模拟数据</Badge>}>
        <div className="module-filters">
          <SelectField label="样本所属功能" value={feature} onChange={(value) => applyFilters(value, decision)}>
            <option value="">全部 AI 功能</option>{features.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </SelectField>
          <SelectField label="样本审核状态" value={decision} onChange={(value) => applyFilters(feature, value)}>
            <option value="">全部审核状态</option>{reviewOptions.map((option) => <option key={option} value={option}>{reviewLabels[option]}</option>)}
          </SelectField>
        </div>
        {filterReset && <p className="module-filter-notice" role="status">已清除与指定样本冲突的筛选条件。</p>}
        {requestedId && !requested && <div className="module-filter-notice"><span>未找到指定样本 {requestedId}。</span><button className="module-text-button" type="button" onClick={() => choose(null)}>返回筛选结果</button></div>}
        {filtered.length ? <Table headings={['样本 ID', '所属功能', '来源事件', '识别质量', '收录资格', '操作']}>
          {filtered.map((sample) => {
            const source = findEvent(sample.eventId)
            return <tr key={sample.id} className={current?.id === sample.id ? 'module-row-active' : ''}>
              <th scope="row" className="mono">{sample.id}</th><td>{source ? featureName(source.featureId) : '—'}</td>
              <td><WorkspaceLink className="module-text-button mono" to={`/events?event=${encodeURIComponent(sample.eventId)}`}>{sample.eventId}</WorkspaceLink></td>
              <td><ReviewBadge decision={reviewFor(sample.eventId)} /></td>
              <td>{sampleOptions.find(([value]) => value === sample.eligibility)?.[1]}</td>
              <td><button className="module-text-button" type="button" aria-label={`${sampleAction}样本 ${sample.id}`} onClick={() => choose(sample.id)}>{sampleAction} <ChevronRight size={15} /></button></td>
            </tr>
          })}
        </Table> : <EmptyState title="没有匹配的样本" description="调整功能或审核状态筛选后重试。" icon={Search} />}
      </Panel>
      {current && <div ref={workspace} className="module-scroll-target"><Panel title={`样本审核工作区 · ${current.id}`} icon={ClipboardCheck} subtitle={canReview || canEditSample ? '识别质量与来源事件同步，修改在本标签页中即时保存。' : '当前账号只能查看样本和审核结论。'} action={<ReviewBadge decision={reviewFor(current.eventId)} />}>
        <div className="module-split">
          <section className="module-soft-block">
            <h3>原始数据</h3>
            <div className="module-evidence"><FileText size={24} /><span>{activeEvent?.evidence || '无关联证据'}</span></div>
            <WorkspaceLink className="module-text-button mono" to={`/events?event=${encodeURIComponent(current.eventId)}`}>来源 {current.eventId} <ChevronRight size={15} /></WorkspaceLink>
          </section>
          <section className="module-soft-block module-sample-edit">
            <h3>识别结果对比</h3>
            <div className="module-original"><span>AI 原始结果</span><strong>{activeEvent?.result || '暂无记录'}</strong></div>
            {canEditSample ? <>
              <label>人工修正<textarea className="field-input" value={current.correction} placeholder="填写修正后的结果" onChange={(event) => update({ correction: event.target.value })} rows={2} /></label>
              <label>样本标签<input className="field-input" value={current.tags} placeholder="填写样本标签" onChange={(event) => update({ tags: event.target.value })} /></label>
            </> : <>
              <SampleFieldValue label="人工修正">{current.correction || '未填写'}</SampleFieldValue>
              <SampleFieldValue label="样本标签">{current.tags || '未填写'}</SampleFieldValue>
            </>}
            <div className="module-inline">
              {activeEvent && (canReview ? <div className="module-review-quality"><span>识别质量</span>
                <GlassSegmentedControl label="设置样本识别质量" className="review-segments" options={reviewSegments}
                  value={decisionOptions.find((option) => option === reviewFor(current.eventId))} onChange={(value) => setReview(activeEvent, value)} />
              </div> : <SampleFieldValue label="识别质量"><ReviewBadge decision={reviewFor(current.eventId)} /></SampleFieldValue>)}
              {canEditSample ? <label>收录资格<SelectField label="设置样本收录资格" value={current.eligibility} onChange={(value) => update({ eligibility: value as SampleEligibility })}>
                {sampleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField></label> : <SampleFieldValue label="收录资格">{sampleOptions.find(([value]) => value === current.eligibility)?.[1]}</SampleFieldValue>}
            </div>
            {canReview && !canEditSample && <span className="module-access-note">当前账号可以修改识别结论，其他样本字段为只读。</span>}
            {!canReview && canEditSample && <span className="module-access-note">当前账号可以编辑样本，识别结论为只读。</span>}
            {reviewFor(current.eventId) === 'conflict' && <p>旧版事件和样本结论不同，需有识别审核权限的账号重新确认。</p>}
          </section>
        </div>
        <div className="module-pagination">
          <button type="button" className="button button--quiet" disabled={currentIndex < 1} onClick={() => choose(filtered[currentIndex - 1].id)}><ArrowLeft size={16} />上一条</button>
          <span className="muted">{currentIndex < 0 ? '当前样本不在筛选结果中' : `${currentIndex + 1} / ${filtered.length}`}</span>
          <button type="button" className="button button--quiet" disabled={currentIndex < 0 || currentIndex >= filtered.length - 1} onClick={() => choose(filtered[currentIndex + 1].id)}>下一条<ArrowRight size={16} /></button>
        </div>
      </Panel></div>}
    </ModulePage>
  )
}

export function DatasetsPage() {
  const [selection, setSelection] = useState(moduleDatasets[0].id)
  const selected = moduleDatasets.find((item) => item.id === selection) ?? moduleDatasets[0]
  return (
    <ModulePage title="数据集管理" description="按 AI 功能和场景查看训练数据集与审核分布。">
      <div className="metrics-grid module-metrics-three">
        <MetricCard label="数据集总数" value={moduleDatasets.length} icon={Database} />
        <MetricCard label="样本记录" value={number.format(moduleDatasets.reduce((total, item) => total + item.count, 0))} icon={ClipboardCheck} />
        <MetricCard label="覆盖 AI 功能" value={new Set(moduleDatasets.map((item) => item.featureId)).size} icon={BrainCircuit} />
      </div>
      <Panel title="数据集管理列表" icon={Database} action={<Badge>模拟数据</Badge>}>
        <Table headings={['数据集名称', 'AI 功能', '场景标签', '样本数', '操作']}>
          {moduleDatasets.map((item) => <tr key={item.id} className={selection === item.id ? 'module-row-active' : ''}>
            <th scope="row">{item.name}</th><td>{featureName(item.featureId)}</td><td>{item.tags}</td><td>{number.format(item.count)}</td>
            <td><button type="button" className="module-text-button" aria-label={`查看数据集 ${item.name}`} onClick={() => setSelection(item.id)}>详情 <ChevronRight size={15} /></button></td>
          </tr>)}
        </Table>
      </Panel>
      <Panel title={`数据集详情 · ${selected.name}`} subtitle={selected.id} icon={FileText}>
        <div className="module-split">
          <section className="module-soft-block"><h3>样本分类</h3><p>{featureName(selected.featureId)} · {selected.tags}</p></section>
          <section className="module-soft-block"><h3>审核分布</h3><p>已审核 {number.format(selected.approved)} 条，待审核 {number.format(selected.count - selected.approved)} 条</p></section>
        </div>
        <p className="module-note"><Download size={15} />当前为只读演示，暂不支持创建、调整样本或导出。</p>
      </Panel>
    </ModulePage>
  )
}

export function ModelsPage() {
  const abnormal = moduleModels.filter((item) => !item.normal)
  const modelFeatures = new Set<AIEvent['featureId']>(moduleModels.flatMap((item) => item.featureIds))
  const uncovered = features.filter(({ id }) => !modelFeatures.has(id))
  return (
    <ModulePage title="模型监控" description="查看模拟模型服务的版本、响应耗时与异常信号。">
      <div className="metrics-grid module-metrics-three">
        <MetricCard label="模型服务" value={moduleModels.length} icon={BrainCircuit} caption="模拟服务清单" />
        <MetricCard label="正常运行" value={moduleModels.length - abnormal.length} icon={CheckCircle2} />
        <MetricCard label="异常服务" value={abnormal.length} icon={CircleAlert} />
      </div>
      <Panel title="模型服务清单" subtitle="每行展示单次模拟探测，不能与 AI 运行分析中的业务平均耗时直接比较。" icon={BrainCircuit} action={<Badge>模拟数据</Badge>}>
        <Table headings={['模型 / 服务', '版本', '关联功能', '探测状态', '单次探测耗时']}>
          {moduleModels.map((item) => <tr key={item.name}>
            <th scope="row">{item.name}</th><td className="mono">{item.version}</td><td>{item.featureIds.map(featureName).join(' / ')}</td>
            <td><Badge tone={item.normal ? 'green' : 'red'} dot>{item.normal ? '模拟正常' : '模拟异常'}</Badge></td><td>{(item.probeMs / 1000).toFixed(1)} s</td>
          </tr>)}
        </Table>
        {uncovered.length > 0 && <p className="module-note">{uncovered.map(({ name }) => name).join('、')}未配置模型服务探测，仍计入业务统计。</p>}
      </Panel>
      <Panel title="模型性能趋势" subtitle="历史模拟探测的小时抽样" icon={ChartNoAxesCombined}><Trend mode="latency" /></Panel>
      <Panel title="问题诊断" icon={Activity}>
        <div className="module-split">
          <section className="module-soft-block"><h3>异常信号</h3><p>{abnormal.length ? `${abnormal.map((item) => item.name).join('、')}的单次模拟探测异常。本页尚未提供底层日志或请求详情。` : '暂无异常的模拟探测。'}</p></section>
          <section className="module-soft-block"><h3>识别结果</h3><p>在事件中心筛选环境声音识别记录。</p><WorkspaceLink className="module-text-button" to="/events">查看 AI 事件中心 <ChevronRight size={15} /></WorkspaceLink></section>
        </div>
      </Panel>
    </ModulePage>
  )
}

function SettingRow({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return <div className={className ? `module-setting-row ${className}` : 'module-setting-row'}><div><strong>{title}</strong>{subtitle && <p>{subtitle}</p>}</div><div>{children}</div></div>
}

export function SettingsPage() {
  const { can } = useAuth()
  const canManageSimulation = can('manageSimulation')
  const { refresh, setRefresh, showEventTime, setShowEventTime } = useDemoSettings()
  const { systemReducesTransparency } = useThemePreference()
  return (
    <ModulePage title="系统设置" description="管理演示界面的显示偏好，查看网络、隐私与维护信息。">
      <div className="module-split module-settings">
        <Panel title="界面与显示" icon={LayoutDashboard}>
          <SettingRow title="自动刷新模拟数据" subtitle={canManageSimulation ? '默认关闭。开启后，监控、设备详情和事件中心每 14 秒更新模拟事件。' : '仅超级管理员可以更改此设置。'}>
            {canManageSimulation ? <Switch label="自动刷新模拟数据" checked={refresh} onChange={setRefresh} /> : <Badge tone={refresh ? 'blue' : 'slate'}>{refresh ? '已开启' : '已关闭'}</Badge>}
          </SettingRow>
          <SettingRow title="显示事件时间" subtitle="控制事件列表、详情和监控状态中的事件时间。"><Switch label="显示事件时间" checked={showEventTime} onChange={setShowEventTime} /></SettingRow>
          <SettingRow title="系统主题" className="module-theme-setting"><ThemeControl /></SettingRow>
          <SettingRow title="透明效果" className="module-theme-setting" subtitle={systemReducesTransparency ? '当前系统已开启“减少透明度”，跟随系统时使用不透明底色。' : '侧栏、顶栏、Dock 与窗口使用毛玻璃材质。'}><TransparencyControl /></SettingRow>
        </Panel>
        <Panel title="网络与部署" icon={Network}>
          <SettingRow title="部署模式"><span className="muted">本地前端</span></SettingRow>
          <SettingRow title="服务端状态"><Badge tone="slate" dot>尚未接入</Badge></SettingRow>
          <SettingRow title="后端接口"><span className="muted">未配置</span></SettingRow>
        </Panel>
        <Panel title="数据与隐私" icon={ShieldCheck}>
          <SettingRow title="事件证据"><span className="muted">仅示例文本</span></SettingRow>
          <SettingRow title="访问权限"><span className="muted">本地演示授权</span></SettingRow>
          <SettingRow title="训练样本使用"><span className="muted">仅演示数据</span></SettingRow>
        </Panel>
        <Panel title="系统维护" icon={HardDrive}>
          <SettingRow title="系统日志"><span className="muted">未连接服务端</span></SettingRow>
          <SettingRow title="数据库备份"><span className="muted">未启用</span></SettingRow>
          <SettingRow title="数据存储"><span className="muted">本地浏览器及会话</span></SettingRow>
        </Panel>
      </div>
      <Panel title="关于系统" icon={AudioLines} action={<Badge>模拟数据</Badge>}>
        <SettingRow title="产品名称"><span className="muted">AI Glasses 管理平台</span></SettingRow>
        <SettingRow title="系统版本"><span className="mono muted">UI V0.1</span></SettingRow>
        <SettingRow title="系统环境"><span className="muted">比赛演示原型</span></SettingRow>
      </Panel>
    </ModulePage>
  )
}
