import { useState, useEffect } from 'react'
import {
  BarChart2,
  Layout,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Info,
  Play,
  Hammer,
  Plus,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { useSSE } from '../../hooks/useSSE'
import { updateConfig, updatePlan } from '../../api/client'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressLog } from '../ui/ProgressLog'
import ChartPreviewCard from '../ui/ChartPreviewCard'
import { CsvAnalysis } from './CsvAnalysis'
import type { DashboardPlan, QAReport, DatasetInfo, ChartSpec } from '../../types'

type Mode = 'prompt' | 'csv'

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: 'prompt', label: 'Dashboard builder', icon: <Layout size={14} /> },
  { id: 'csv', label: 'Analyse CSV / Excel', icon: <FileSpreadsheet size={14} /> },
]

const VIZ_ICONS: Record<string, string> = {
  big_number_total: '🔢',
  echarts_timeseries_line: '📈',
  bar: '📊',
  dist_bar: '📊',
  pie: '🥧',
  table: '🗂️',
  echarts_scatter: '⚡',
  scatter: '⚡',
}

const VIZ_OPTIONS = [
  { value: 'bar', label: 'Bar chart' },
  { value: 'echarts_timeseries_line', label: 'Line chart' },
  { value: 'pie', label: 'Pie chart' },
  { value: 'big_number_total', label: 'Big number' },
  { value: 'table', label: 'Table' },
]

function VizBadge({ vizType }: { vizType: string }) {
  const icon = VIZ_ICONS[vizType] ?? '📉'
  return (
    <Badge variant="accent">
      {icon} {vizType}
    </Badge>
  )
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Plan' },
    { n: 2, label: 'Review & Edit' },
    { n: 3, label: 'Build' },
  ]
  return (
    <div className="flex items-center gap-0 mb-2">
      {steps.map(({ n, label }, i) => (
        <div key={n} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === n
                  ? 'bg-accent text-white'
                  : step > n
                  ? 'bg-success text-white'
                  : 'bg-surface text-text-muted border border-border'
              }`}
            >
              {step > n ? '✓' : n}
            </div>
            <span
              className={`text-xs font-medium transition-colors ${
                step === n ? 'text-accent' : step > n ? 'text-success' : 'text-text-muted'
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mx-2 h-px w-8 transition-colors ${step > n ? 'bg-success' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

interface PlanTableProps {
  plan: DashboardPlan
}

function PlanTable({ plan }: PlanTableProps) {
  return (
    <div className="space-y-4">
      <Card title={`Charts (${plan.charts.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Title', 'Viz Type', 'Width', 'Columns', 'Reasoning'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.charts.map((chart, i) => {
                const metricCols = chart.metrics
                  .map((m) => {
                    const metric = m as Record<string, unknown>
                    const col = metric['column'] as Record<string, unknown> | undefined
                    return (col?.['column_name'] as string) ?? ''
                  })
                  .filter(Boolean)
                const cols = [...chart.groupby, ...(chart.time_column ? [chart.time_column] : []), ...metricCols]
                return (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0
                        ? 'border-b border-border/50 bg-card'
                        : 'border-b border-border/50 bg-stripe'
                    }
                  >
                    <td className="px-3 py-2 font-medium text-text">{chart.title}</td>
                    <td className="px-3 py-2">
                      <VizBadge vizType={chart.viz_type} />
                    </td>
                    <td className="px-3 py-2 text-text-muted">{chart.width}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(cols)].map((c) => (
                          <span
                            key={c}
                            className="rounded bg-border px-1.5 py-0.5 font-mono text-[10px] text-text-muted"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-text-muted max-w-[180px]">{chart.reasoning}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {plan.filters.length > 0 && (
        <Card title={`Filters (${plan.filters.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface">
                  {['Column', 'Type', 'Label', 'Default'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.filters.map((f, i) => (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0
                        ? 'border-b border-border/50 bg-card'
                        : 'border-b border-border/50 bg-stripe'
                    }
                  >
                    <td className="px-3 py-2 font-mono text-text">{f.column_name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="muted">{f.filter_type}</Badge>
                    </td>
                    <td className="px-3 py-2 text-text-muted">{f.label}</td>
                    <td className="px-3 py-2 font-mono text-text-dim">{f.default_value ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Add chart form ──────────────────────────────────────────────────────────

interface AddChartFormProps {
  datasetInfo: DatasetInfo
  onAdd: (chart: ChartSpec) => void
  onCancel: () => void
}

function AddChartForm({ datasetInfo, onAdd, onCancel }: AddChartFormProps) {
  const [title, setTitle] = useState('')
  const [vizType, setVizType] = useState('bar')
  const numericCols = datasetInfo.columns.filter((c) => c.type === 'NUMERIC').map((c) => c.column_name)
  const dimCols = datasetInfo.columns.filter((c) => c.type === 'STRING').map((c) => c.column_name)
  const [metricCol, setMetricCol] = useState(numericCols[0] ?? '')
  const [dimensionCol, setDimensionCol] = useState(dimCols[0] ?? '')

  function handleAdd() {
    if (!title.trim() || !metricCol) return
    const chart: ChartSpec = {
      title: title.trim(),
      viz_type: vizType,
      metrics: [
        {
          expressionType: 'SIMPLE',
          column: { column_name: metricCol },
          aggregate: 'SUM',
          label: `SUM(${metricCol})`,
        },
      ],
      groupby: dimensionCol ? [dimensionCol] : [],
      time_column: null,
      time_grain: null,
      width: 6,
      reasoning: 'Added manually',
    }
    onAdd(chart)
  }

  return (
    <div className="border border-accent/40 rounded-lg p-4 bg-card space-y-3 text-sm">
      <p className="font-medium text-text">New chart</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-text-muted text-xs block mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chart title"
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-text-muted text-xs block mb-1">Chart type</label>
          <select
            value={vizType}
            onChange={(e) => setVizType(e.target.value)}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent"
          >
            {VIZ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-text-muted text-xs block mb-1">Metric column</label>
          <select
            value={metricCol}
            onChange={(e) => setMetricCol(e.target.value)}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent"
          >
            <option value="">— select —</option>
            {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {vizType !== 'big_number_total' && (
          <div>
            <label className="text-text-muted text-xs block mb-1">Dimension</label>
            <select
              value={dimensionCol}
              onChange={(e) => setDimensionCol(e.target.value)}
              className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent"
            >
              <option value="">— none —</option>
              {dimCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={handleAdd} disabled={!title.trim() || !metricCol}>
          Add chart
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function Phase3() {
  const {
    sessionId,
    phase3,
    setPhase3,
    phase2,
    fetchAuditLog,
    dbConfig,
    supersetConfig,
    llmModel,
    phase3Step,
    editedPlan,
    setPhase3Step,
    setEditedPlan,
    removeChartFromPlan,
    updateChartInPlan,
    addChartToPlan,
  } = useAppStore()

  const [mode, setMode] = useState<Mode>('prompt')

  const planSSE = useSSE()
  const buildSSE = useSSE()

  const [datasetName, setDatasetName] = useState(
    phase3.datasetName || phase2.queryPlan?.dataset_name_suggestion || ''
  )
  const [dashboardTitle, setDashboardTitle] = useState(phase3.dashboardTitle || '')

  const suggestedDatasetName = phase2.queryPlan?.dataset_name_suggestion ?? ''
  useEffect(() => {
    if (suggestedDatasetName && !datasetName) {
      setDatasetName(suggestedDatasetName)
    }
  }, [suggestedDatasetName])
  const [requirements, setRequirements] = useState(phase3.requirements || '')
  const [dashboardId, setDashboardId] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [buildLoading, setBuildLoading] = useState(false)

  const dashboardPlan = phase3.dashboardPlan as DashboardPlan | null
  const datasetInfo = phase3.datasetInfo as DatasetInfo | null
  const qaReport = phase3.qaReport as QAReport | null

  // On plan SSE done — store result and advance to step 2
  useEffect(() => {
    if (planSSE.isDone && planSSE.result && !phase3.planReady) {
      const data = planSSE.result as { dashboard_plan: DashboardPlan; dataset_info?: DatasetInfo }
      setPhase3({
        dashboardPlan: data.dashboard_plan,
        planReady: true,
        datasetInfo: data.dataset_info ?? null,
        datasetName,
        dashboardTitle,
        requirements,
      })
      void fetchAuditLog()
    }
  }, [planSSE.isDone, planSSE.result, phase3.planReady, setPhase3, datasetName, dashboardTitle, requirements, fetchAuditLog])

  // On build SSE done — store result
  useEffect(() => {
    if (buildSSE.isDone && buildSSE.result) {
      const data = buildSSE.result as {
        dashboard_url: string | null
        qa_report: QAReport | null
      }
      setPhase3({
        dashboardUrl: data.dashboard_url ?? null,
        qaReport: data.qa_report ?? null,
      })
      if (data.dashboard_url) {
        toast.success('Dashboard built successfully!')
      }
      void fetchAuditLog()
    }
  }, [buildSSE.isDone, buildSSE.result, setPhase3, fetchAuditLog])

  async function handlePlan() {
    if (!sessionId) return
    await updateConfig(sessionId, {
      db: { ...dbConfig },
      superset: { ...supersetConfig },
      llm_model: llmModel,
    }).catch(() => {/* silent */})
    planSSE.reset()
    setPhase3({ planReady: false, dashboardPlan: null, dashboardUrl: null, datasetInfo: null })
    setEditedPlan(null)
    setPhase3Step(1)
    const qs = new URLSearchParams({
      dataset_name: datasetName,
      dashboard_title: dashboardTitle,
      requirements,
    }).toString()
    planSSE.start(
      `/api/sessions/${sessionId}/phase3/plan?${qs}`,
      `/api/sessions/${sessionId}/state`
    )
  }

  function handleGoToReview() {
    if (!dashboardPlan) return
    setEditedPlan(dashboardPlan)
    setPhase3Step(2)
  }

  async function handleBuild() {
    if (!sessionId || !editedPlan) return
    setBuildLoading(true)
    try {
      await updatePlan(sessionId, editedPlan)
    } catch (e) {
      toast.error('Failed to sync plan: ' + String(e))
      setBuildLoading(false)
      return
    }
    setBuildLoading(false)
    setPhase3Step(3)
    await updateConfig(sessionId, {
      db: { ...dbConfig },
      superset: { ...supersetConfig },
      llm_model: llmModel,
    }).catch(() => {/* silent */})
    buildSSE.reset()
    setPhase3({ dashboardUrl: null, qaReport: null })
    const qs = new URLSearchParams()
    if (dashboardId) qs.set('dashboard_id', dashboardId)
    qs.set('dry_run', String(dryRun))
    buildSSE.start(
      `/api/sessions/${sessionId}/phase3/build?${qs.toString()}`,
      `/api/sessions/${sessionId}/state`
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl w-full mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text">Dashboard Builder</h1>
        <p className="mt-1 text-sm text-text-muted">
          Plan, review, and build your Superset dashboard from a dataset.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 p-1 rounded-lg bg-surface border border-border w-fit">
        {MODES.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === id
                ? 'bg-card text-text shadow-sm border border-border'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* CSV mode */}
      {mode === 'csv' && sessionId && (
        <CsvAnalysis sessionId={sessionId} />
      )}

      {/* Dashboard builder mode */}
      {mode === 'prompt' && (
      <>

      {/* Step indicator */}
      <StepIndicator step={phase3Step} />

      {/* ── Step 1: Plan ─────────────────────────────────────────────────── */}
      {(phase3Step === 1 || phase3Step === 2) && (
        <div className={phase3Step === 2 ? 'opacity-60 pointer-events-none select-none' : ''}>
          <Card>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Dataset Name"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="my_dataset_name"
                />
                <Input
                  label="Dashboard Title"
                  value={dashboardTitle}
                  onChange={(e) => setDashboardTitle(e.target.value)}
                  placeholder="Sales Performance Dashboard"
                />
              </div>
              <Textarea
                label="Requirements"
                rows={5}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder={[
                  'Describe the charts and filters you want. e.g.:',
                  '- Show total revenue as a headline number',
                  '- Line chart of revenue by month',
                  '- Bar chart of top 10 customers by revenue',
                  '- Filter by region and date range',
                ].join('\n')}
              />
              <div className="flex items-end gap-4">
                <div className="max-w-[220px]">
                  <Input
                    label="Dashboard ID (optional, for update mode)"
                    value={dashboardId}
                    onChange={(e) => setDashboardId(e.target.value)}
                    placeholder="42"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer mb-0.5">
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer ${
                      dryRun ? 'bg-accent' : 'bg-border'
                    }`}
                    onClick={() => setDryRun((d) => !d)}
                  >
                    <div
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        dryRun ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                  <span className="text-sm text-text-muted">Dry Run</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  icon={<Layout size={15} />}
                  loading={planSSE.isStreaming}
                  disabled={!datasetName.trim() || !dashboardTitle.trim() || !requirements.trim()}
                  onClick={handlePlan}
                >
                  {planSSE.isStreaming ? 'Planning...' : 'Plan Dashboard'}
                </Button>
                {phase3Step === 2 && (
                  <Button variant="secondary" icon={<Play size={14} />} onClick={() => setPhase3Step(1)}>
                    Back to plan
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Plan progress */}
          {phase3Step === 1 && (
            <div className="mt-4">
              <ProgressLog
                logs={planSSE.logs}
                isStreaming={planSSE.isStreaming}
                isDone={planSSE.isDone}
                error={planSSE.error}
              />
            </div>
          )}

          {/* Plan done — show summary + "Review" button */}
          <AnimatePresence>
            {phase3Step === 1 && dashboardPlan && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-4"
              >
                <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                  <BarChart2 size={16} className="text-accent mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-text mb-1">
                      {dashboardPlan.dashboard_title}
                    </p>
                    <p className="text-xs text-text-muted">{dashboardPlan.reasoning}</p>
                  </div>
                </div>

                {dryRun && (
                  <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
                    <Info size={15} className="text-warning shrink-0" />
                    <p className="text-sm text-warning">
                      Dry Run mode: plan only, no changes will be made in Superset.
                    </p>
                  </div>
                )}

                <PlanTable plan={dashboardPlan} />

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    icon={<ArrowRight size={15} />}
                    onClick={handleGoToReview}
                  >
                    Review & Edit Charts
                  </Button>
                  <Button variant="secondary" icon={<Play size={14} />} onClick={handlePlan}>
                    Re-plan
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Step 2: Review & Edit ─────────────────────────────────────────── */}
      <AnimatePresence>
        {phase3Step === 2 && editedPlan && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text">Review &amp; Edit Charts</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Preview each chart with real data. Edit, remove, or add charts before building.
                </p>
              </div>
              <span className="text-xs text-text-muted">
                {editedPlan.charts.length} chart{editedPlan.charts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Chart grid */}
            {editedPlan.charts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {editedPlan.charts.map((chart) => (
                  <ChartPreviewCard
                    key={chart.title}
                    chart={chart}
                    sessionId={sessionId ?? ''}
                    datasetInfo={datasetInfo ?? { id: 0, name: '', columns: [], metrics: [] }}
                    onRemove={() => removeChartFromPlan(chart.title)}
                    onUpdate={(updates) => updateChartInPlan(chart.title, updates)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-text-muted">
                No charts remaining. Add one below or go back to re-plan.
              </div>
            )}

            {/* Add chart */}
            {showAddForm && datasetInfo ? (
              <AddChartForm
                datasetInfo={datasetInfo}
                onAdd={(chart) => {
                  addChartToPlan(chart)
                  setShowAddForm(false)
                }}
                onCancel={() => setShowAddForm(false)}
              />
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
              >
                <Plus size={13} /> Add chart
              </button>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              {!dryRun ? (
                <Button
                  variant="success"
                  icon={<Hammer size={15} />}
                  loading={buildLoading}
                  disabled={editedPlan.charts.length === 0}
                  onClick={handleBuild}
                >
                  {buildLoading ? 'Syncing plan...' : 'Generate Dashboard'}
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-warning">
                  <Info size={14} />
                  Dry Run: build disabled
                </div>
              )}
              <Button variant="secondary" icon={<Play size={14} />} onClick={handlePlan}>
                Re-plan
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step 3: Build ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase3Step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text">Building Dashboard</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Creating charts and assembling the dashboard in Superset.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPhase3Step(2)}
                disabled={buildSSE.isStreaming}
              >
                ← Back to review
              </Button>
            </div>

            <ProgressLog
              logs={buildSSE.logs}
              isStreaming={buildSSE.isStreaming}
              isDone={buildSSE.isDone}
              error={buildSSE.error}
            />

            <AnimatePresence>
              {phase3.dashboardUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
                    <CheckCircle2 size={20} className="text-success shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-success">Dashboard built successfully!</p>
                      <p className="mt-0.5 text-xs text-text-muted font-mono truncate">
                        {phase3.dashboardUrl}
                      </p>
                    </div>
                    <a href={phase3.dashboardUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="success" size="sm" icon={<ExternalLink size={13} />}>
                        Open Dashboard
                      </Button>
                    </a>
                  </div>

                  {qaReport && (
                    <Card title="QA Report">
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          {qaReport.passed ? (
                            <>
                              <CheckCircle2 size={16} className="text-success" />
                              <span className="text-sm font-semibold text-success">All checks passed</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={16} className="text-error" />
                              <span className="text-sm font-semibold text-error">Issues found</span>
                            </>
                          )}
                        </div>
                        {qaReport.issues.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-text-muted mb-1">Issues:</p>
                            <ul className="space-y-1">
                              {qaReport.issues.map((issue, i) => (
                                <li key={i} className="text-xs text-error">
                                  • {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {qaReport.suggestions.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-text-muted mb-1">Suggestions:</p>
                            <ul className="space-y-1">
                              {qaReport.suggestions.map((s, i) => (
                                <li key={i} className="text-xs text-warning">
                                  → {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  <Button variant="secondary" icon={<Play size={14} />} onClick={handlePlan}>
                    Plan another dashboard
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  )
}
