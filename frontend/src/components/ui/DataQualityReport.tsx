import type { DataQualityReport, DQColumnProfile } from '../../types'
import { X, Download, AlertTriangle, Info, CheckCircle } from 'lucide-react'

interface Props {
  report: DataQualityReport
  onClose: () => void
  onExportPdf: () => void
}

function scoreColor(score: number): string {
  if (score >= 90) return '#22c55e'
  if (score >= 75) return '#14b8a6'
  if (score >= 50) return '#f59e0b'
  if (score >= 25) return '#f97316'
  return '#ef4444'
}

function nullCellClass(pct: number): string {
  if (pct === 0) return ''
  if (pct <= 5) return 'text-text'
  if (pct <= 20) return 'text-warning'
  return 'text-error font-semibold'
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-500/15 text-red-400 border border-red-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    info: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  }
  const Icon = severity === 'critical' ? AlertTriangle : severity === 'warning' ? AlertTriangle : Info
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium capitalize ${map[severity] ?? ''}`}>
      <Icon size={11} />
      {severity}
    </span>
  )
}

function sortProfiles(profiles: DQColumnProfile[]): DQColumnProfile[] {
  const rank = (p: DQColumnProfile) => {
    if (p.min_date !== undefined && p.min_date !== null) return 0
    if (p.min_val !== undefined && p.min_val !== null) return 1
    return 2
  }
  return [...profiles].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    return (b.null_pct ?? 0) - (a.null_pct ?? 0)
  })
}

export default function DataQualityReportPanel({ report, onClose, onExportPdf }: Props) {
  const color = scoreColor(report.overall_score)
  const m = report.dataset_metrics
  const sortedProfiles = sortProfiles(report.column_profiles)

  const criticals = report.issues.filter((i) => i.severity === 'critical')
  const warnings = report.issues.filter((i) => i.severity === 'warning')
  const infos = report.issues.filter((i) => i.severity === 'info')

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface">
        <div className="flex items-center gap-4">
          <div
            className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white"
            style={{ background: color }}
          >
            {report.overall_score}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-text">Data Quality Report</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: color + '25', color }}
              >
                {report.overall_grade}
              </span>
            </div>
            <div className="text-sm text-text-muted">{report.dataset_name}</div>
            <div className="text-xs text-text-dim mt-0.5">
              {new Date(report.generated_at).toLocaleString()} · {m.sample_size.toLocaleString()} rows sampled
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-text-muted hover:text-text hover:border-border transition-colors"
          >
            <Download size={13} />
            Export PDF
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {report.error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{report.error}</span>
          </div>
        )}

        {/* Dataset overview */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">Dataset Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Rows', value: m.total_rows.toLocaleString() },
              { label: 'Columns', value: String(m.total_columns) },
              { label: 'Duplicates', value: `${m.duplicate_rows_pct}%`, highlight: m.duplicate_rows_pct > 0 },
              { label: 'Cols w/ Nulls', value: String(m.columns_with_nulls), highlight: m.columns_with_nulls > 0 },
            ].map((card) => (
              <div key={card.label} className="rounded-lg bg-surface border border-border p-3 text-center">
                <div
                  className={`text-2xl font-bold ${card.highlight ? 'text-warning' : 'text-text'}`}
                >
                  {card.value}
                </div>
                <div className="text-xs text-text-muted mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* LLM Summary */}
        {report.summary && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">AI Summary</h3>
            <div
              className="p-3 rounded-lg text-sm text-text-muted border-l-4"
              style={{ borderColor: color, background: color + '10' }}
            >
              {report.summary}
            </div>
          </div>
        )}

        {/* Issues */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            Issues ({report.issues.length})
          </h3>
          {report.issues.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle size={15} />
              No issues detected
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Critical', items: criticals },
                { label: 'Warning', items: warnings },
                { label: 'Info', items: infos },
              ]
                .filter((g) => g.items.length > 0)
                .map((group) => (
                  <div key={group.label}>
                    <div className="text-xs font-medium text-text-dim mb-2">{group.label}</div>
                    <div className="space-y-1.5">
                      {group.items.map((iss, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-2.5 rounded-lg bg-surface border border-border text-sm"
                        >
                          <SeverityBadge severity={iss.severity} />
                          <div className="flex-1 min-w-0">
                            <span className="text-text">{iss.description}</span>
                            {iss.column && (
                              <span className="ml-2 text-xs text-text-dim font-mono">{iss.column}</span>
                            )}
                          </div>
                          {iss.affected_pct !== null && (
                            <span className="text-xs text-text-dim whitespace-nowrap">{iss.affected_pct}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Column profiles */}
        {sortedProfiles.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
              Column Profiles ({sortedProfiles.length})
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    <th className="text-left px-3 py-2 text-text-dim font-medium">Column</th>
                    <th className="text-left px-3 py-2 text-text-dim font-medium">Type</th>
                    <th className="text-right px-3 py-2 text-text-dim font-medium">Null %</th>
                    <th className="text-right px-3 py-2 text-text-dim font-medium">Distinct</th>
                    <th className="text-right px-3 py-2 text-text-dim font-medium">Min</th>
                    <th className="text-right px-3 py-2 text-text-dim font-medium">Max</th>
                    <th className="text-right px-3 py-2 text-text-dim font-medium">Outliers</th>
                    <th className="text-left px-3 py-2 text-text-dim font-medium">Top Values / Range</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProfiles.map((p, idx) => (
                    <tr
                      key={p.name}
                      className={`border-b border-border last:border-b-0 hover:bg-surface/50 transition-colors ${
                        idx % 2 === 0 ? '' : 'bg-stripe/30'
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-text font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-text-dim">{p.dtype}</td>
                      <td className={`px-3 py-2 text-right ${nullCellClass(p.null_pct)}`}>
                        {p.null_pct}%
                      </td>
                      <td className="px-3 py-2 text-right text-text-muted">{p.distinct_count}</td>
                      <td className="px-3 py-2 text-right text-text-muted font-mono text-[11px]">
                        {p.min_date ?? (p.min_val !== undefined && p.min_val !== null ? p.min_val : '—')}
                      </td>
                      <td className="px-3 py-2 text-right text-text-muted font-mono text-[11px]">
                        {p.max_date ?? (p.max_val !== undefined && p.max_val !== null ? p.max_val : '—')}
                      </td>
                      <td className="px-3 py-2 text-right text-text-muted">
                        {p.outlier_count !== undefined && p.outlier_count !== null
                          ? `${p.outlier_count} (${p.outlier_pct}%)`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-text-dim max-w-[200px] truncate">
                        {p.min_date
                          ? `${p.date_range_days ?? '?'} days${p.future_dates_count ? ` · ${p.future_dates_count} future` : ''}`
                          : p.top_values
                          ? p.top_values
                              .slice(0, 3)
                              .map((v) => v.value)
                              .join(', ')
                          : p.mean_val !== undefined && p.mean_val !== null
                          ? `avg ${p.mean_val}${p.zeros_pct ? ` · ${p.zeros_pct}% zero` : ''}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-text-dim text-center">
          Based on {m.sample_size.toLocaleString()}-row sample · Generated by DATA VIZ
        </p>
      </div>
    </div>
  )
}
