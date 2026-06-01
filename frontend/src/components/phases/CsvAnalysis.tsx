import { useState, useRef, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Upload, Send, Plus, Trash2, FileDown, TableIcon, BarChart2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import {
  uploadCsvFile, queryCsv, addCsvChart, removeCsvChart,
  exportCsvPdf, exportCsvExcel,
} from '../../api/client'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import type { CsvChart, CsvQueryResult } from '../../types'

const PIE_COLORS = ['#1D9E75', '#534AB7', '#D85A30', '#BA7517', '#185FA5', '#D4537E']

function formatNumber(n: number | undefined): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

interface ChartData {
  label: string
  value: number
}

function buildChartData(result: CsvQueryResult): ChartData[] {
  if (!result.rows.length || !result.columns.length) return []
  const xCol = result.columns[0]
  const yCol = result.columns.find((c) => c !== xCol) ?? xCol
  return result.rows.slice(0, 50).map((row) => ({
    label: String(row[xCol] ?? ''),
    value: Number(row[yCol] ?? 0),
  }))
}

interface InlineChartProps {
  result: CsvQueryResult
}

function InlineChart({ result }: InlineChartProps) {
  const data = buildChartData(result)

  if (result.chart_type === 'big_number') {
    const val = result.rows[0]?.[result.columns[0]]
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-4xl font-bold text-accent">
          {typeof val === 'number' ? formatNumber(val) : String(val ?? '—')}
        </span>
      </div>
    )
  }

  if (result.chart_type === 'table' || data.length === 0) return null

  if (result.chart_type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={70} label>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatNumber(typeof v === 'number' ? v : undefined)} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (result.chart_type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} tickFormatter={formatNumber} />
          <Tooltip formatter={(v) => formatNumber(typeof v === 'number' ? v : undefined)} />
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} tickFormatter={formatNumber} />
        <Tooltip formatter={(v) => formatNumber(typeof v === 'number' ? v : undefined)} />
        <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface CanvasChartCardProps {
  chart: CsvChart
  sessionId: string
  onRemove: () => void
}

function CanvasChartCard({ chart, onRemove }: CanvasChartCardProps) {
  const data: ChartData[] = chart.rows.slice(0, 50).map((row) => ({
    label: String(row[chart.x_col] ?? ''),
    value: Number(row[chart.y_col] ?? 0),
  }))

  const renderChart = () => {
    if (chart.chart_type === 'big_number') {
      const val = chart.rows[0]?.[chart.y_col]
      return (
        <div className="flex items-center justify-center h-24">
          <span className="text-3xl font-bold text-accent">
            {typeof val === 'number' ? formatNumber(val) : String(val ?? '—')}
          </span>
        </div>
      )
    }
    if (chart.chart_type === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={55} label>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatNumber(typeof v === 'number' ? v : undefined)} />
          </PieChart>
        </ResponsiveContainer>
      )
    }
    if (chart.chart_type === 'line') {
      return (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} tickFormatter={formatNumber} />
            <Tooltip formatter={(v) => formatNumber(typeof v === 'number' ? v : undefined)} />
            <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )
    }
    if (chart.chart_type === 'table') {
      const cols = chart.columns.slice(0, 4)
      return (
        <div className="overflow-x-auto max-h-36">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border">
                {cols.map((c) => (
                  <th key={c} className="px-2 py-1 text-left text-text-muted font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.slice(0, 8).map((row, i) => (
                <tr key={i} className="border-b border-border/30">
                  {cols.map((c) => (
                    <td key={c} className="px-2 py-1 text-text truncate max-w-[80px]">
                      {String(row[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    return (
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} />
          <YAxis tick={{ fontSize: 9 }} tickLine={false} tickFormatter={formatNumber} />
          <Tooltip formatter={(v) => formatNumber(typeof v === 'number' ? v : undefined)} />
          <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-text leading-tight">{chart.title}</p>
        <button onClick={onRemove} className="text-text-muted hover:text-error transition-colors shrink-0">
          <Trash2 size={12} />
        </button>
      </div>
      <p className="text-[10px] text-text-muted italic truncate">{chart.question}</p>
      {renderChart()}
    </div>
  )
}

// ── Result table ────────────────────────────────────────────────────────────

function ResultTable({ result }: { result: CsvQueryResult }) {
  const cols = result.columns.slice(0, 8)
  return (
    <div className="overflow-x-auto max-h-48 rounded border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-surface z-10">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium text-text-muted border-b border-border">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, 50).map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-stripe'}>
              {cols.map((c) => (
                <td key={c} className="px-3 py-1.5 text-text truncate max-w-[160px]">
                  {String(row[c] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

interface Props {
  sessionId: string
}

export function CsvAnalysis({ sessionId }: Props) {
  const {
    csvSession,
    csvChatHistory,
    csvCanvasCharts,
    setCsvSession,
    appendCsvChatMessage,
    setCsvChatHistory,
    setCsvCanvasCharts,
    addCsvCanvasChart,
    removeCsvCanvasChart,
  } = useAppStore()

  const [uploading, setUploading] = useState(false)
  const [question, setQuestion] = useState('')
  const [querying, setQuerying] = useState(false)
  const [currentResult, setCurrentResult] = useState<CsvQueryResult | null>(null)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)
  const [addingChart, setAddingChart] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [csvChatHistory])

  async function handleFileUpload(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      toast.error('Only CSV and Excel files are supported')
      return
    }
    setUploading(true)
    try {
      const session = await uploadCsvFile(sessionId, file)
      setCsvSession(session)
      setCsvChatHistory([])
      setCsvCanvasCharts([])
      setCurrentResult(null)
      toast.success(`Loaded ${session.row_count.toLocaleString()} rows from ${session.filename}`)
    } catch (e) {
      toast.error('Upload failed: ' + String(e))
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) void handleFileUpload(file)
  }

  async function handleAsk() {
    if (!question.trim() || !csvSession || querying) return
    const q = question.trim()
    setQuestion('')
    const userTurn = { role: 'user' as const, content: q }
    const nextHistory = [...csvChatHistory, userTurn]
    appendCsvChatMessage(userTurn)
    setQuerying(true)
    try {
      const result = await queryCsv(sessionId, q, nextHistory)
      if (result.error) {
        appendCsvChatMessage({ role: 'assistant', content: `Error: ${result.error}` })
        toast.error(result.error)
      } else {
        setCurrentResult(result)
        const summary = `Found ${result.row_count.toLocaleString()} rows. Showing as ${result.chart_type} chart.`
        appendCsvChatMessage({ role: 'assistant', content: summary })
      }
    } catch (e) {
      toast.error('Query failed: ' + String(e))
      appendCsvChatMessage({ role: 'assistant', content: 'Query failed. Try rephrasing.' })
    } finally {
      setQuerying(false)
    }
  }

  async function handleAddToCanvas() {
    if (!currentResult || !csvSession) return
    const title = currentResult.question.slice(0, 60)
    const id = `chart_${Date.now()}`
    const xCol = currentResult.columns[0] ?? ''
    const yCol = currentResult.columns.find((c) => c !== xCol) ?? xCol
    const chart: CsvChart = {
      id,
      title,
      chart_type: currentResult.chart_type,
      columns: currentResult.columns,
      rows: currentResult.rows.slice(0, 100),
      x_col: xCol,
      y_col: yCol,
      question: currentResult.question,
      added_at: new Date().toISOString(),
    }
    setAddingChart(true)
    try {
      await addCsvChart(sessionId, chart)
      addCsvCanvasChart(chart)
      toast.success('Chart added to canvas')
    } catch (e) {
      toast.error('Failed to add chart: ' + String(e))
    } finally {
      setAddingChart(false)
    }
  }

  async function handleRemoveChart(chartId: string) {
    try {
      await removeCsvChart(sessionId, chartId)
      removeCsvCanvasChart(chartId)
    } catch {
      removeCsvCanvasChart(chartId)
    }
  }

  async function handleExport(type: 'pdf' | 'excel') {
    if (!csvCanvasCharts.length) {
      toast.error('Add at least one chart to the canvas first')
      return
    }
    setExporting(type)
    try {
      if (type === 'pdf') {
        await exportCsvPdf(sessionId)
        toast.success('PDF downloaded')
      } else {
        await exportCsvExcel(sessionId)
        toast.success('Excel downloaded')
      }
    } catch (e) {
      toast.error(`Export failed: ${String(e)}`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex gap-4 h-full min-h-[600px]">
      {/* ── Left panel: dataset info + chat ─────────────────────────────── */}
      <div className="w-[30%] flex flex-col gap-4 min-w-0">
        {/* Upload zone */}
        {!csvSession ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent/60 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} className="mx-auto text-text-muted mb-2" />
            <p className="text-sm font-medium text-text">Drop a CSV or Excel file</p>
            <p className="text-xs text-text-muted mt-1">or click to browse</p>
            {uploading && <Spinner size={16} className="mx-auto mt-3" />}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFileUpload(file)
              }}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text truncate">{csvSession.filename}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {csvSession.row_count.toLocaleString()} rows · {csvSession.columns.length} columns
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-accent hover:underline shrink-0"
              >
                Change
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFileUpload(file)
              }}
            />
            {/* Column list */}
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {csvSession.columns.map((col) => (
                <span
                  key={col.name}
                  className="rounded bg-border px-1.5 py-0.5 font-mono text-[10px] text-text-muted"
                  title={col.dtype}
                >
                  {col.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        {csvSession && (
          <div className="flex flex-col flex-1 rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-surface">
              <p className="text-xs font-semibold text-text">Ask a question</p>
            </div>

            {/* Chat history */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[320px]">
              {csvChatHistory.length === 0 && (
                <p className="text-xs text-text-muted italic">
                  Ask anything about your data. e.g. "Show total sales by region" or "Top 5 products by revenue"
                </p>
              )}
              {csvChatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`text-xs rounded-lg px-3 py-2 max-w-[90%] ${
                    msg.role === 'user'
                      ? 'bg-accent/15 text-text ml-auto'
                      : 'bg-surface text-text-muted'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {querying && (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Spinner size={12} /> Thinking...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAsk() } }}
                placeholder="Ask about your data..."
                className="flex-1 bg-bg border border-border rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent"
                disabled={querying}
              />
              <button
                onClick={() => void handleAsk()}
                disabled={!question.trim() || querying}
                className="p-1.5 rounded bg-accent text-white disabled:opacity-40 hover:bg-accent/80 transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel: result + canvas ────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Current result */}
        {currentResult && !currentResult.error ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-text">{currentResult.question}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {currentResult.row_count.toLocaleString()} rows · SQL: <span className="font-mono">{currentResult.sql.slice(0, 60)}…</span>
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={12} />}
                loading={addingChart}
                onClick={() => void handleAddToCanvas()}
              >
                Add to canvas
              </Button>
            </div>
            <InlineChart result={currentResult} />
            <ResultTable result={currentResult} />
          </div>
        ) : !csvSession ? (
          <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border text-center p-8">
            <div>
              <BarChart2 size={32} className="mx-auto text-text-muted mb-3" />
              <p className="text-sm text-text-muted">Upload a file to start analysing</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <TableIcon size={24} className="mx-auto text-text-muted mb-2" />
            <p className="text-sm text-text-muted">Ask a question to see results here</p>
          </div>
        )}

        {/* Canvas */}
        <div className="rounded-xl border border-border bg-card flex-1">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface rounded-t-xl">
            <div>
              <p className="text-xs font-semibold text-text">Dashboard canvas</p>
              <p className="text-xs text-text-muted mt-0.5">
                {csvCanvasCharts.length} chart{csvCanvasCharts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={exporting === 'pdf' ? <Spinner size={12} /> : <FileDown size={12} />}
                loading={exporting === 'pdf'}
                disabled={!csvCanvasCharts.length}
                onClick={() => void handleExport('pdf')}
              >
                PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={exporting === 'excel' ? <Spinner size={12} /> : <FileDown size={12} />}
                loading={exporting === 'excel'}
                disabled={!csvCanvasCharts.length}
                onClick={() => void handleExport('excel')}
              >
                Excel
              </Button>
            </div>
          </div>

          {csvCanvasCharts.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">
              Add charts from the result panel to build your dashboard
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {csvCanvasCharts.map((chart) => (
                <CanvasChartCard
                  key={chart.id}
                  chart={chart}
                  sessionId={sessionId}
                  onRemove={() => void handleRemoveChart(chart.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
