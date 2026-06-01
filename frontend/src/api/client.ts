import type {
  TableProfile,
  AuditLog,
  ChartPreviewData,
  DashboardPlan,
  CsvSession,
  CsvQueryResult,
  CsvChart,
  DataQualityReport,
  DashboardHistory,
  DashboardHistorySummary,
  VersionSnapshot,
  ErdData,
  GenerateDescriptionsResponse,
} from '../types'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const data = await res.json()
      detail = data.detail || detail
    } catch {
      // ignore
    }
    throw new ApiError(detail, res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function createSession(): Promise<{ session_id: string }> {
  return request('POST', '/session')
}

export async function getDefaults(): Promise<{
  superset_url: string
  superset_username: string
  llm_model: string
}> {
  return request('GET', '/config/defaults')
}

export async function updateConfig(
  sid: string,
  config: {
    db?: {
      type: string
      host: string
      port: number
      database: string
      username: string
      password: string
    }
    superset?: { url: string; username: string; password: string; session_cookie?: string; csrf_token?: string }
    llm_model?: string
  }
): Promise<void> {
  return request('PUT', `/sessions/${sid}/config`, config)
}

export async function testDbConnection(
  sid: string
): Promise<{ ok: boolean; message: string }> {
  return request('POST', `/sessions/${sid}/db/test`)
}

export async function profileTable(
  sid: string,
  tableName: string
): Promise<TableProfile> {
  return request('POST', `/sessions/${sid}/phase1/profile-table`, {
    table_name: tableName,
  })
}

export async function addTable(
  sid: string,
  tableName: string,
  columns: string[]
): Promise<void> {
  return request('POST', `/sessions/${sid}/phase1/add-table`, {
    table_name: tableName,
    selected_columns: columns,
  })
}

export async function confirmPhase1(sid: string): Promise<void> {
  return request('POST', `/sessions/${sid}/phase1/confirm`)
}

export async function confirmPhase2(
  sid: string,
  editedSql: string
): Promise<void> {
  return request('POST', `/sessions/${sid}/phase2/confirm`, {
    edited_sql: editedSql,
  })
}

export function exploreSSE(sid: string, prompt: string): EventSource {
  const url = `/api/sessions/${sid}/phase1/explore?prompt=${encodeURIComponent(prompt)}`
  return new EventSource(url)
}

export function generateQuerySSE(sid: string): EventSource {
  return new EventSource(`/api/sessions/${sid}/phase2/generate`)
}

export function planDashboardSSE(
  sid: string,
  params: {
    dataset_name: string
    dashboard_title: string
    requirements: string
  }
): EventSource {
  const qs = new URLSearchParams({
    dataset_name: params.dataset_name,
    dashboard_title: params.dashboard_title,
    requirements: params.requirements,
  }).toString()
  return new EventSource(`/api/sessions/${sid}/phase3/plan?${qs}`)
}

export function buildDashboardSSE(
  sid: string,
  params: { dashboard_id?: string; dry_run: boolean }
): EventSource {
  const qs = new URLSearchParams()
  if (params.dashboard_id) qs.set('dashboard_id', params.dashboard_id)
  qs.set('dry_run', String(params.dry_run))
  return new EventSource(`/api/sessions/${sid}/phase3/build?${qs.toString()}`)
}

export async function getChartPreview(
  sessionId: string,
  params: {
    viz_type: string
    metric_col: string
    aggregate?: string
    dimension_col?: string
    time_col?: string
    time_grain?: string
    row_limit?: number
  }
): Promise<ChartPreviewData> {
  const qs = new URLSearchParams({ viz_type: params.viz_type, metric_col: params.metric_col })
  if (params.aggregate) qs.set('aggregate', params.aggregate)
  if (params.dimension_col) qs.set('dimension_col', params.dimension_col)
  if (params.time_col) qs.set('time_col', params.time_col)
  if (params.time_grain) qs.set('time_grain', params.time_grain)
  if (params.row_limit != null) qs.set('row_limit', String(params.row_limit))
  return request('GET', `/sessions/${sessionId}/phase3/chart-preview?${qs.toString()}`)
}

export async function updatePlan(sessionId: string, plan: DashboardPlan): Promise<void> {
  return request('POST', `/sessions/${sessionId}/phase3/plan/update`, { plan })
}

export async function getAuditLog(sessionId: string): Promise<AuditLog> {
  return request('GET', `/sessions/${sessionId}/audit`)
}

export async function clearAuditLog(sessionId: string): Promise<void> {
  return request('DELETE', `/sessions/${sessionId}/audit`)
}

export async function uploadCsvFile(sessionId: string, file: File): Promise<CsvSession> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/sessions/${sessionId}/csv/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const data = await res.json()
      detail = data.detail || detail
    } catch { /* ignore */ }
    throw new ApiError(detail, res.status)
  }
  return res.json()
}

export async function queryCsv(
  sessionId: string,
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<CsvQueryResult> {
  return request('POST', `/sessions/${sessionId}/csv/query`, { question, history })
}

export async function addCsvChart(sessionId: string, chart: CsvChart): Promise<{ ok: boolean }> {
  return request('POST', `/sessions/${sessionId}/csv/add-chart`, chart)
}

export async function removeCsvChart(sessionId: string, chartId: string): Promise<{ ok: boolean }> {
  return request('DELETE', `/sessions/${sessionId}/csv/charts/${chartId}`)
}

export async function exportCsvPdf(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/csv/export/pdf`, { method: 'POST' })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dashboard.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportCsvExcel(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/csv/export/excel`, { method: 'POST' })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dashboard.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

export async function getDataQualityReport(sessionId: string, datasetName: string): Promise<DataQualityReport> {
  return request('GET', `/sessions/${sessionId}/phase3/data-quality?dataset_name=${encodeURIComponent(datasetName)}`)
}

export async function exportDQReportPdf(sessionId: string, report: DataQualityReport): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/phase3/data-quality/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data-quality-report.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

export async function getDashboardHistoryList(
  sessionId: string
): Promise<{ dashboards: DashboardHistorySummary[] }> {
  return request('GET', `/sessions/${sessionId}/dashboard-history`)
}

export async function getDashboardHistory(
  sessionId: string,
  dashboardId: number
): Promise<DashboardHistory> {
  return request('GET', `/sessions/${sessionId}/dashboard-history/${dashboardId}`)
}

export async function getVersionSnapshot(
  sessionId: string,
  dashboardId: number,
  version: number
): Promise<VersionSnapshot> {
  return request('GET', `/sessions/${sessionId}/dashboard-history/${dashboardId}/versions/${version}`)
}

export async function restoreVersion(
  sessionId: string,
  dashboardId: number,
  version: number
): Promise<{ ok: boolean; message?: string; error?: string; saved_version?: number; backup_version?: number }> {
  return request('POST', `/sessions/${sessionId}/dashboard-history/${dashboardId}/restore/${version}`)
}

export async function deleteVersion(
  sessionId: string,
  dashboardId: number,
  version: number
): Promise<{ ok: boolean }> {
  return request('DELETE', `/sessions/${sessionId}/dashboard-history/${dashboardId}/versions/${version}`)
}

export async function downloadVersionSnapshot(
  sessionId: string,
  dashboardId: number,
  version: number
): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/dashboard-history/${dashboardId}/versions/${version}/download`)
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dashboard_${dashboardId}_v${version}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function getErdData(sessionId: string): Promise<ErdData> {
  return request('GET', `/sessions/${sessionId}/phase1/erd-data`)
}

export async function generateChartDescriptions(
  sessionId: string,
  payload: {
    chart_ids: number[]
    chart_specs: Array<{
      id: number
      title: string
      viz_type: string
      metrics: unknown[]
      groupby: string[]
      time_column: string | null
      time_grain: string | null
    }>
    dataset_name: string
    dashboard_title: string
  }
): Promise<GenerateDescriptionsResponse> {
  return request('POST', `/sessions/${sessionId}/phase3/generate-descriptions`, payload)
}
