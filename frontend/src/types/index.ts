export interface SessionConfig {
  db: DbConfig
  superset: SupersetConfig
  llmModel: string
}

export interface DbConfig {
  type: 'postgresql' | 'mysql' | 'mongodb'
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface SupersetConfig {
  url: string
  username: string
  password: string
  session_cookie?: string
  csrf_token?: string
}

export interface ColumnProfile {
  column_name: string
  data_type: string
  sample_values: string[]
  null_pct: number
  is_likely_pk: boolean
  is_likely_fk: boolean
  is_likely_date: boolean
}

export interface TableProfile {
  table_name: string
  row_count: number
  columns: ColumnProfile[]
  sample_rows: Record<string, unknown>[]
}

export interface SchemaMap {
  all_tables: string[]
  profiled_tables: TableProfile[]
  suggested_primary: string
  suggested_joins: string[]
  agent_reasoning: string
}

export interface QueryPlan {
  sql: string
  calculated_columns: { name: string; expression: string; description: string }[]
  dataset_name_suggestion: string
  grain_description: string
  agent_reasoning: string
}

export interface DatasetQAReport {
  passed: boolean
  row_count: number
  duplicate_row_count: number
  issues: string[]
  suggestions: string[]
  sample_rows: Record<string, unknown>[]
}

export interface DatasetColumn {
  column_name: string
  type: string
  is_dttm: boolean
  expression: string | null
  distinct_values: string[] | null
}

export interface DatasetInfo {
  id: number
  name: string
  columns: DatasetColumn[]
  metrics: Record<string, unknown>[]
}

export interface ChartSpec {
  title: string
  viz_type: string
  metrics: Record<string, unknown>[]
  groupby: string[]
  time_column: string | null
  time_grain: string | null
  width: number
  reasoning: string
}

export interface FilterSpec {
  column_name: string
  filter_type: string
  label: string
  default_value: string | null
}

export interface DashboardPlan {
  dashboard_title: string
  charts: ChartSpec[]
  filters: FilterSpec[]
  reasoning: string
}

export interface QAReport {
  passed: boolean
  issues: string[]
  suggestions: string[]
}

export interface SSEEvent {
  type: 'progress' | 'done' | 'error'
  message?: string
  step?: number
  total?: number
  data?: unknown
}

export interface ExcludedTable {
  profiled: boolean
  profile: TableProfile | null
  selected_columns: string[]
  added: boolean
  error: string | null
}

export interface AuditEntry {
  id: string
  timestamp: string
  phase: 0 | 1 | 2 | 3
  event_type: string
  title: string
  detail: string
  data: Record<string, unknown> | null
  status: 'info' | 'success' | 'warning' | 'error'
}

export interface AuditLog {
  entries: AuditEntry[]
}

export interface ChartPreviewData {
  rows: Array<{ label: string; value: number }>
  total?: number | null
  error?: string | null
}

export interface CsvColumn {
  name: string
  dtype: string
  sample: string[]
}

export interface CsvQueryResult {
  question: string
  sql: string
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  chart_type: 'bar' | 'line' | 'pie' | 'table' | 'big_number'
  error: string | null
}

export interface CsvChart {
  id: string
  title: string
  chart_type: string
  columns: string[]
  rows: Record<string, unknown>[]
  x_col: string
  y_col: string
  question: string
  added_at: string
}

export interface CsvSession {
  filename: string
  row_count: number
  columns: CsvColumn[]
  charts: CsvChart[]
}

export interface DQIssue {
  severity: 'critical' | 'warning' | 'info'
  column: string | null
  issue_type: string
  description: string
  affected_rows: number | null
  affected_pct: number | null
}

export interface DQColumnProfile {
  name: string
  dtype: string
  null_count: number
  null_pct: number
  distinct_count: number
  distinct_pct: number
  min_val?: number | null
  max_val?: number | null
  mean_val?: number | null
  std_dev?: number | null
  outlier_count?: number | null
  outlier_pct?: number | null
  zeros_pct?: number | null
  top_values?: Array<{ value: string; count: number; pct: number }> | null
  avg_length?: number | null
  min_date?: string | null
  max_date?: string | null
  date_range_days?: number | null
  future_dates_count?: number | null
}

export interface DQDatasetMetrics {
  total_rows: number
  total_columns: number
  duplicate_rows_count: number
  duplicate_rows_pct: number
  columns_with_nulls: number
  columns_all_null: number
  columns_single_value: number
  sample_size: number
}

export interface DataQualityReport {
  dataset_name: string
  generated_at: string
  overall_score: number
  overall_grade: string
  summary: string
  dataset_metrics: DQDatasetMetrics
  issues: DQIssue[]
  column_profiles: DQColumnProfile[]
  error: string | null
}

export interface VersionSummary {
  version: number
  created_at: string
  chart_count: number
  change_summary: string
  file: string
}

export interface DashboardHistory {
  dashboard_id: number
  dashboard_title: string
  dashboard_url: string
  versions: VersionSummary[]
}

export interface DashboardHistorySummary {
  dashboard_id: number
  dashboard_title: string
  dashboard_url: string
  version_count: number
  latest_version: number
  last_updated: string
}

export interface VersionSnapshot {
  version: number
  dashboard_id: number
  dashboard_title: string
  dashboard_url: string
  created_at: string
  created_by: string
  requirements_prompt: string
  dataset_name: string
  chart_count: number
  filter_count: number
  position_json: Record<string, unknown>
  charts: Array<{
    id: number
    title: string
    viz_type: string
    dataset_id: number
    params?: Record<string, unknown>
  }>
  filters: Array<{
    id: string
    name: string
    filter_type: string
    column: string
  }>
  change_summary: string
}

export interface ErdColumn {
  name: string
  type: string
  is_pk: boolean
  is_fk: boolean
  is_date: boolean
  null_pct: number
}

export interface ErdTableNode {
  table_name: string
  row_count: number | null
  columns: ErdColumn[]
  is_primary: boolean
  is_selected: boolean
}

export interface ErdEdge {
  join_table: string
  source_table: string
  source_col: string
  target_table: string
  target_col: string
  join_string: string
}

export interface ErdData {
  selected_nodes: ErdTableNode[]
  excluded_nodes: ErdTableNode[]
  edges: ErdEdge[]
  suggested_primary: string
}

export interface ChartDescriptionResult {
  id: number
  title: string
  description: string
  ok: boolean
  error?: string | null
}

export interface GenerateDescriptionsResponse {
  results: ChartDescriptionResult[]
  total: number
  succeeded: number
  failed: number
  error: string | null
}
