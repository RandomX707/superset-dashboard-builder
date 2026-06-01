import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  History,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import {
  deleteVersion,
  downloadVersionSnapshot,
  getVersionSnapshot,
  restoreVersion,
} from '../../api/client'
import type { VersionSnapshot } from '../../types'

type SnapshotTab = 'charts' | 'filters' | 'requirements' | 'json'

interface Props {
  sessionId: string
  onClose: () => void
}

function formatDate(value: string): string {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleString()
}

export function VersionHistoryPanel({ sessionId, onClose }: Props) {
  const {
    versionHistory,
    fetchAllDashboardHistory,
    loadDashboardHistory,
    setCurrentHistory,
    setSelectedSnapshot,
  } = useAppStore()

  const [tab, setTab] = useState<SnapshotTab>('charts')
  const [restoreTarget, setRestoreTarget] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const history = versionHistory.currentHistory
  const snapshot = versionHistory.selectedSnapshot

  const sortedVersions = useMemo(
    () => [...(history?.versions ?? [])].sort((a, b) => b.version - a.version),
    [history]
  )
  const latestVersion = sortedVersions[0]?.version ?? 0

  useEffect(() => {
    void fetchAllDashboardHistory()
  }, [fetchAllDashboardHistory])

  async function handleLoadHistory(dashboardId: number) {
    setBanner(null)
    setSelectedSnapshot(null)
    await loadDashboardHistory(dashboardId)
  }

  async function handleViewSnapshot(version: number) {
    if (!history) return
    setActionLoading(version)
    try {
      const data = await getVersionSnapshot(sessionId, history.dashboard_id, version)
      setSelectedSnapshot(data)
      setTab('charts')
      setBanner(null)
    } catch (e) {
      toast.error('Failed to load snapshot: ' + String(e))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDownload(version: number) {
    if (!history) return
    try {
      await downloadVersionSnapshot(sessionId, history.dashboard_id, version)
    } catch (e) {
      toast.error('Download failed: ' + String(e))
    }
  }

  async function handleRestore(version: number) {
    if (!history) return
    setActionLoading(version)
    try {
      const res = await restoreVersion(sessionId, history.dashboard_id, version)
      if (res.ok) {
        const suffix = res.saved_version ? ` Current state saved as v${res.saved_version}.` : ''
        setBanner(`Restored to v${version}.${suffix}`)
        setRestoreTarget(null)
        await loadDashboardHistory(history.dashboard_id)
        await fetchAllDashboardHistory()
      } else {
        toast.error(res.error ?? 'Restore failed')
      }
    } catch (e) {
      toast.error('Restore failed: ' + String(e))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(version: number) {
    if (!history) return
    setActionLoading(version)
    try {
      const res = await deleteVersion(sessionId, history.dashboard_id, version)
      if (res.ok) {
        setDeleteTarget(null)
        setBanner(`Deleted v${version}`)
        await loadDashboardHistory(history.dashboard_id)
        await fetchAllDashboardHistory()
      } else {
        toast.error('Delete failed')
      }
    } catch (e) {
      toast.error('Delete failed: ' + String(e))
    } finally {
      setActionLoading(null)
    }
  }

  function backToAll() {
    setCurrentHistory(null)
    setSelectedSnapshot(null)
    setBanner(null)
  }

  function backToVersions() {
    setSelectedSnapshot(null)
    setBanner(null)
  }

  return (
    <AnimatePresence>
      <>
        <motion.div
          key="version-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />

        <motion.div
          key="version-panel"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.2 }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: 'min(680px, 100vw)',
            height: '100vh',
            zIndex: 50,
            background: 'var(--color-card)',
            borderLeft: '0.5px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
            {snapshot ? (
              <button
                onClick={backToVersions}
                className="rounded p-1 hover:bg-surface transition-colors text-text-muted hover:text-text"
              >
                <ArrowLeft size={16} />
              </button>
            ) : history ? (
              <button
                onClick={backToAll}
                className="rounded p-1 hover:bg-surface transition-colors text-text-muted hover:text-text"
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <History size={16} className="text-accent" />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-text truncate">
                {snapshot
                  ? `v${snapshot.version} snapshot`
                  : history
                  ? history.dashboard_title
                  : 'Dashboard Version History'}
              </h2>
              {history && !snapshot && history.dashboard_url && (
                <a
                  href={history.dashboard_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-accent"
                >
                  Open in Superset <ExternalLink size={11} />
                </a>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 hover:bg-surface transition-colors text-text-muted hover:text-text"
            >
              <X size={16} />
            </button>
          </div>

          {banner && (
            <div className="mx-5 mt-4 rounded border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              {banner}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {snapshot ? (
              <SnapshotDetail snapshot={snapshot} tab={tab} setTab={setTab} />
            ) : history ? (
              <div className="space-y-3">
                {sortedVersions.map((version) => {
                  const isLatest = version.version === latestVersion
                  return (
                    <div key={version.version} className="rounded-lg border border-border bg-bg p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 shrink-0">
                          <div className="text-sm font-bold text-accent">v{version.version}</div>
                          {isLatest && (
                            <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                              current
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text">{version.change_summary}</p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {version.chart_count} charts · {formatDate(version.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <SmallAction onClick={() => void handleViewSnapshot(version.version)}>
                            View
                          </SmallAction>
                          <SmallAction onClick={() => void handleDownload(version.version)}>
                            <Download size={12} /> JSON
                          </SmallAction>
                          {!isLatest && (
                            <SmallAction onClick={() => setRestoreTarget(version.version)}>
                              <RotateCcw size={12} /> Restore
                            </SmallAction>
                          )}
                          {!isLatest && (
                            <SmallAction danger onClick={() => setDeleteTarget(version.version)}>
                              <Trash2 size={12} /> Delete
                            </SmallAction>
                          )}
                        </div>
                      </div>
                      {restoreTarget === version.version && (
                        <ConfirmBox
                          text={`Restore dashboard to v${version.version}? This will overwrite the current dashboard in Superset.`}
                          confirmLabel="Confirm restore"
                          loading={actionLoading === version.version}
                          onConfirm={() => void handleRestore(version.version)}
                          onCancel={() => setRestoreTarget(null)}
                        />
                      )}
                      {deleteTarget === version.version && (
                        <ConfirmBox
                          danger
                          text={`Delete v${version.version}? This cannot be undone.`}
                          confirmLabel="Delete"
                          loading={actionLoading === version.version}
                          onConfirm={() => void handleDelete(version.version)}
                          onCancel={() => setDeleteTarget(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : versionHistory.allDashboards.length === 0 ? (
              <p className="text-sm text-text-dim text-center mt-8">
                {versionHistory.loading
                  ? 'Loading version history...'
                  : 'No dashboard history yet. Build a dashboard to start tracking versions.'}
              </p>
            ) : (
              <div className="space-y-3">
                {versionHistory.allDashboards.map((dashboard) => (
                  <div
                    key={dashboard.dashboard_id}
                    className="rounded-lg border border-border bg-bg p-4 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text truncate">{dashboard.dashboard_title}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {dashboard.version_count} versions · Last updated {formatDate(dashboard.last_updated)}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleLoadHistory(dashboard.dashboard_id)}
                      className="shrink-0 rounded px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
                    >
                      View versions →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  )
}

function SmallAction({
  children,
  danger = false,
  onClick,
}: {
  children: React.ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
        danger
          ? 'text-error/80 hover:bg-error/10 hover:text-error'
          : 'text-text-muted hover:bg-surface hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

function ConfirmBox({
  text,
  confirmLabel,
  danger = false,
  loading,
  onConfirm,
  onCancel,
}: {
  text: string
  confirmLabel: string
  danger?: boolean
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3 rounded border border-border bg-surface p-3">
      <p className="text-xs text-text-muted">{text}</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
            danger ? 'bg-error text-white' : 'bg-accent text-white'
          }`}
        >
          {loading ? 'Working...' : confirmLabel}
        </button>
        <button
          onClick={onCancel}
          className="rounded px-2 py-1 text-xs text-text-muted hover:bg-border hover:text-text"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function SnapshotDetail({
  snapshot,
  tab,
  setTab,
}: {
  snapshot: VersionSnapshot
  tab: SnapshotTab
  setTab: (tab: SnapshotTab) => void
}) {
  const tabs: Array<{ id: SnapshotTab; label: string }> = [
    { id: 'charts', label: 'Charts' },
    { id: 'filters', label: 'Filters' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'json', label: 'Raw JSON' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`rounded px-3 py-1 text-xs font-medium ${
              tab === item.id
                ? 'bg-accent text-white'
                : 'text-text-muted hover:bg-surface hover:text-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'charts' && (
        <SimpleTable
          headers={['Chart title', 'Viz type', 'Dataset ID']}
          rows={snapshot.charts.map((chart) => [
            chart.title,
            chart.viz_type,
            String(chart.dataset_id ?? ''),
          ])}
        />
      )}
      {tab === 'filters' && (
        <SimpleTable
          headers={['Filter name', 'Column', 'Type']}
          rows={snapshot.filters.map((filter) => [
            filter.name,
            filter.column,
            filter.filter_type,
          ])}
        />
      )}
      {tab === 'requirements' && (
        <pre className="rounded bg-surface p-3 text-xs text-text-muted whitespace-pre-wrap">
          {snapshot.requirements_prompt || 'No requirements prompt stored.'}
        </pre>
      )}
      {tab === 'json' && (
        <pre className="rounded bg-surface p-3 text-[11px] font-mono text-text-muted overflow-x-auto">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      )}
    </div>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-xs">
        <thead className="bg-surface">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-left font-medium text-text-muted">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-center text-text-dim" colSpan={headers.length}>
                None
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border/50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 text-text-muted">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
