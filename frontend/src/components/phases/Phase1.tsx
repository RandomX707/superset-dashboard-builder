import { useState, useEffect } from 'react'
import {
  Database,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Trash2,
  ArrowRight,
  Plus,
  Network,
} from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { useSSE } from '../../hooks/useSSE'
import { addTable, confirmPhase1, getErdData, profileTable } from '../../api/client'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Input'
import { Card, Zone, SectionHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressLog } from '../ui/ProgressLog'
import { Spinner } from '../ui/Spinner'
import { ERDDiagram } from '../ui/ERDDiagram'
import type { SchemaMap, ExcludedTable, TableProfile } from '../../types'

function TableCard({ table }: { table: TableProfile }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-text">
            {table.table_name}
          </span>
          <Badge variant="muted">
            {table.row_count.toLocaleString()} rows
          </Badge>
          <Badge variant="accent">{table.columns.length} cols</Badge>
        </div>
        {open ? (
          <ChevronDown size={14} className="text-text-muted" />
        ) : (
          <ChevronRight size={14} className="text-text-muted" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface">
                      {['Column', 'Type', 'Null%', 'Flags', 'Samples'].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-medium text-text-muted"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {table.columns.map((col, i) => (
                      <tr
                        key={col.column_name}
                        className={clsx(
                          'border-t border-border/50',
                          i % 2 === 0 ? 'bg-card' : 'bg-stripe'
                        )}
                      >
                        <td className="px-3 py-1.5 font-mono font-medium text-text">
                          {col.column_name}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-text-muted">
                          {col.data_type}
                        </td>
                        <td className="px-3 py-1.5 text-text-muted">
                          {col.null_pct.toFixed(0)}%
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex gap-1">
                            {col.is_likely_pk && (
                              <Badge variant="accent">PK</Badge>
                            )}
                            {col.is_likely_fk && (
                              <Badge variant="warning">FK</Badge>
                            )}
                            {col.is_likely_date && (
                              <Badge variant="muted">DATE</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-text-muted max-w-[200px] truncate">
                          {col.sample_values.slice(0, 3).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ExcludedTableEntryProps {
  name: string
  entry: ExcludedTable
  sessionId: string
  onAdded: (selectedColumns: string[]) => void
}

function ExcludedTableEntry({
  name,
  entry,
  sessionId,
  onAdded,
}: ExcludedTableEntryProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    setAdding(true)
    try {
      await addTable(sessionId, name, selected)
      onAdded(selected)
      toast.success(`Added ${name} to schema`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-text-muted">{name}</span>
          {entry.added && <Badge variant="success">Added</Badge>}
          {entry.error && <Badge variant="error">Error</Badge>}
        </div>
        {open ? (
          <ChevronDown size={13} className="text-text-muted" />
        ) : (
          <ChevronRight size={13} className="text-text-muted" />
        )}
      </button>

      <AnimatePresence>
        {open && entry.profile && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-3 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-muted">
                  Select columns to include (leave empty for all):
                </p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {entry.profile.columns.map((col) => {
                    const isSel = selected.includes(col.column_name)
                    return (
                      <button
                        key={col.column_name}
                        className={clsx(
                          'rounded px-2 py-0.5 text-xs font-mono border transition-colors',
                          isSel
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-border text-text-muted hover:border-accent/40'
                        )}
                        onClick={() =>
                          setSelected((prev) =>
                            isSel
                              ? prev.filter((c) => c !== col.column_name)
                              : [...prev, col.column_name]
                          )
                        }
                      >
                        {col.column_name}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={13} />}
                loading={adding}
                disabled={entry.added}
                onClick={handleAdd}
              >
                {entry.added ? 'Added' : 'Add to Schema'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Phase1() {
  const {
    sessionId,
    dbConnected,
    phase1,
    setPhase1,
    erdData,
    erdVisible,
    setErdData,
    setErdVisible,
    setActivePhase,
    phase1Prompt,
    setPhase1Prompt,
    fetchAuditLog,
  } =
    useAppStore()
  const businessPrompt = phase1Prompt
  const setBusinessPrompt = setPhase1Prompt
  const { logs, isStreaming, isDone, error, result, start, reset } = useSSE()
  const [showReasoning, setShowReasoning] = useState(false)
  const [showExcluded, setShowExcluded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [erdLoading, setErdLoading] = useState(false)

  async function fetchErdData() {
    if (!sessionId) return
    setErdLoading(true)
    try {
      const data = await getErdData(sessionId)
      setErdData(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg)
    } finally {
      setErdLoading(false)
    }
  }

  // When SSE completes, update store
  useEffect(() => {
    if (isDone && result && !phase1.schemaMap) {
      const data = result as {
        schema_map: SchemaMap
        excluded_tables: Record<string, ExcludedTable>
      }
      setPhase1({
        schemaMap: data.schema_map,
        excludedTables: data.excluded_tables,
        confirmed: false,
      })
      setErdData(null)
      void fetchAuditLog()
    }
  }, [isDone, result, phase1.schemaMap, setErdData, setPhase1, fetchAuditLog])

  function handleExplore() {
    if (!sessionId || !businessPrompt.trim()) return
    // Reset previous results
    setPhase1({ schemaMap: null, excludedTables: {}, confirmed: false })
    setErdData(null)
    setErdVisible(false)
    reset()
    start(
      `/api/sessions/${sessionId}/phase1/explore?prompt=${encodeURIComponent(
        businessPrompt
      )}`,
      `/api/sessions/${sessionId}/state`
    )
  }

  async function handleConfirm() {
    if (!sessionId) return
    setConfirming(true)
    try {
      await confirmPhase1(sessionId)
      setPhase1({ confirmed: true })
      setActivePhase(2)
      toast.success('Phase 1 confirmed! Moving to query builder.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg)
    } finally {
      setConfirming(false)
    }
  }

  function handleRerun() {
    setPhase1({ schemaMap: null, excludedTables: {}, confirmed: false })
    setErdData(null)
    setErdVisible(false)
    reset()
  }

  async function handleProfileFromErd(tableName: string) {
    if (!sessionId) return
    const existing = phase1.excludedTables[tableName]
    if (existing?.profile) {
      setShowExcluded(true)
      toast.message(`Select columns for ${tableName} in Excluded Tables`)
      return
    }
    try {
      const profile = await profileTable(sessionId, tableName)
      setPhase1({
        excludedTables: {
          ...phase1.excludedTables,
          [tableName]: {
            profiled: true,
            profile,
            selected_columns: [],
            added: false,
            error: null,
          },
        },
      })
      setShowExcluded(true)
      toast.success(`Profiled ${tableName}. Select columns in Excluded Tables.`)
      if (erdVisible) void fetchErdData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg)
    }
  }

  function handleTableAdded(name: string, entry: ExcludedTable, selectedColumns: string[]) {
    const profile = entry.profile
    const selectedProfile: TableProfile | null = profile
      ? {
          ...profile,
          columns:
            selectedColumns.length > 0
              ? profile.columns.filter((col) => selectedColumns.includes(col.column_name))
              : profile.columns,
        }
      : null

    setPhase1({
      schemaMap:
        schemaMap && selectedProfile
          ? {
              ...schemaMap,
              all_tables: schemaMap.all_tables.includes(name)
                ? schemaMap.all_tables
                : [...schemaMap.all_tables, name],
              profiled_tables: schemaMap.profiled_tables.some((table) => table.table_name === name)
                ? schemaMap.profiled_tables
                : [...schemaMap.profiled_tables, selectedProfile],
            }
          : schemaMap,
      excludedTables: {
        ...excludedTables,
        [name]: { ...entry, added: true, selected_columns: selectedColumns },
      },
    })
    if (erdVisible) void fetchErdData()
  }

  const schemaMap = phase1.schemaMap as SchemaMap | null
  const excludedTables = phase1.excludedTables as Record<string, ExcludedTable>

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl w-full mx-auto">
      {/* Header */}
      <SectionHeader
        eyebrow="Phase 1"
        title="Schema Explorer"
        subtitle="Describe what you want to build and we'll identify the relevant database tables."
      />

      {/* Input */}
      <Zone label="Requirement">
        <div className="p-4 space-y-4">
          <Textarea
            label="Business requirement"
            rows={4}
            value={businessPrompt}
            onChange={(e) => setBusinessPrompt(e.target.value)}
            placeholder="e.g. I want to understand sales performance by region and product category over the last 12 months"
          />
          <Button
            variant="primary"
            icon={<Database size={15} />}
            loading={isStreaming}
            disabled={!dbConnected || !businessPrompt.trim()}
            onClick={handleExplore}
          >
            {isStreaming ? 'Exploring...' : 'Explore Schema'}
          </Button>
          {!dbConnected && (
            <p className="text-xs text-warning">
              Connect to a database first using the sidebar.
            </p>
          )}
        </div>
      </Zone>

      {/* Progress */}
      <ProgressLog
        logs={logs}
        isStreaming={isStreaming}
        isDone={isDone}
        error={error}
      />

      {/* Results */}
      <AnimatePresence>
        {schemaMap && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Reasoning */}
            <Zone
              label="Agent Reasoning"
              headerRight={
                <button onClick={() => setShowReasoning((o) => !o)} className="text-text-dim hover:text-text-muted transition-colors">
                  {showReasoning ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              }
            >
              {showReasoning && (
                <div className="px-4 py-3">
                  <p className="text-sm text-text-muted leading-relaxed">
                    {schemaMap.agent_reasoning}
                  </p>
                </div>
              )}
            </Zone>

            {/* Selected tables */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text">
                  Selected Tables
                </h2>
                <Badge variant="accent">
                  {schemaMap.profiled_tables.length} tables
                </Badge>
                <Badge variant="success">
                  Primary: {schemaMap.suggested_primary}
                </Badge>
              </div>
              <div className="space-y-3">
                {schemaMap.profiled_tables.map((t) => (
                  <TableCard key={t.table_name} table={t} />
                ))}
              </div>
            </div>

            {/* Suggested joins */}
            {schemaMap.suggested_joins.length > 0 && (
              <Zone label="Suggested Joins">
                <div className="space-y-2 p-4">
                  {schemaMap.suggested_joins.map((join, i) => (
                    <pre
                      key={i}
                      className="rounded bg-surface p-3 text-xs font-mono text-text-muted overflow-x-auto"
                    >
                      {join}
                    </pre>
                  ))}
                </div>
              </Zone>
            )}

            {/* ERD diagram */}
            <Zone
              label="Relationship Diagram"
              headerRight={
                <button
                  onClick={() => {
                    const next = !erdVisible
                    setErdVisible(next)
                    if (next && !erdData) void fetchErdData()
                  }}
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-text-muted hover:bg-surface hover:text-text transition-colors"
                >
                  <Network size={13} />
                  {erdVisible ? 'Hide diagram' : 'Show diagram'}
                </button>
              }
            >
              {erdVisible && (
                <div className="p-4">
                  {erdData ? (
                    <ERDDiagram
                      erdData={erdData}
                      sessionId={sessionId ?? ''}
                      onAddExcludedTable={(tableName) => void handleProfileFromErd(tableName)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded border border-border bg-card px-4 py-6 text-sm text-text-muted">
                      <Spinner size={16} />
                      {erdLoading ? 'Loading diagram...' : 'Diagram data not loaded'}
                    </div>
                  )}
                </div>
              )}
            </Zone>

            {/* Excluded tables */}
            {Object.keys(excludedTables).length > 0 && (
              <Card>
                <button
                  className="flex w-full items-center justify-between px-4 py-3"
                  onClick={() => setShowExcluded((o) => !o)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">
                      Excluded Tables
                    </span>
                    <Badge variant="muted">
                      {Object.keys(excludedTables).length}
                    </Badge>
                  </div>
                  {showExcluded ? (
                    <ChevronDown size={14} className="text-text-muted" />
                  ) : (
                    <ChevronRight size={14} className="text-text-muted" />
                  )}
                </button>
                {showExcluded && (
                  <div className="border-t border-border p-4 space-y-2">
                    {Object.entries(excludedTables).map(([name, entry]) => (
                      <ExcludedTableEntry
                        key={name}
                        name={name}
                        entry={entry}
                        sessionId={sessionId ?? ''}
                        onAdded={(selectedColumns) => handleTableAdded(name, entry, selectedColumns)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                icon={<ArrowRight size={15} />}
                loading={confirming}
                onClick={handleConfirm}
              >
                Confirm & Continue
              </Button>
              <Button
                variant="secondary"
                icon={<RefreshCw size={14} />}
                onClick={handleRerun}
              >
                Re-run
              </Button>
              <Button
                variant="ghost"
                icon={<Trash2 size={14} />}
                onClick={handleRerun}
              >
                Clear Cache & Re-run
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
