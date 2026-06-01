import { useState, useEffect } from 'react'
import {
  Zap,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Copy,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import CodeMirror, { defaultLightThemeOption } from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { dracula } from '@uiw/codemirror-theme-dracula'
import { useAppStore } from '../../store/appStore'
import { useSSE } from '../../hooks/useSSE'
import { confirmPhase2 } from '../../api/client'
import { Button } from '../ui/Button'
import { Zone, SectionHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressLog } from '../ui/ProgressLog'
import { DataTable } from '../ui/DataTable'
import type { QueryPlan, DatasetQAReport } from '../../types'

export function Phase2() {
  const { sessionId, phase1, phase2, theme, setPhase2, setPhase3, setActivePhase, fetchAuditLog } =
    useAppStore()
  const { logs, isStreaming, isDone, error, result, start, reset } = useSSE()
  const [showReasoning, setShowReasoning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)

  // Sync SQL from store to editor
  const [localSql, setLocalSql] = useState(phase2.editedSql || '')

  useEffect(() => {
    if (phase2.editedSql) setLocalSql(phase2.editedSql)
  }, [phase2.editedSql])

  // When SSE completes, store result
  useEffect(() => {
    if (isDone && result && !phase2.queryPlan) {
      const data = result as { query_plan: QueryPlan; qa_report: DatasetQAReport | null }
      setPhase2({
        queryPlan: data.query_plan,
        qaReport: data.qa_report,
        editedSql: data.query_plan.sql,
        confirmed: false,
      })
      setLocalSql(data.query_plan.sql)
      void fetchAuditLog()
    }
  }, [isDone, result, phase2.queryPlan, setPhase2, fetchAuditLog])

  if (!phase1.confirmed) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        <div className="text-center">
          <Info size={32} className="mx-auto mb-3 text-text-dim" />
          <p className="text-sm">Complete Phase 1 first to proceed.</p>
        </div>
      </div>
    )
  }

  function handleGenerate() {
    if (!sessionId) return
    reset()
    start(
      `/api/sessions/${sessionId}/phase2/generate`,
      `/api/sessions/${sessionId}/state`
    )
  }

  async function handleConfirm() {
    if (!sessionId) return
    setConfirming(true)
    try {
      await confirmPhase2(sessionId, localSql)
      setPhase2({ confirmed: true, editedSql: localSql })
      setActivePhase(3)
      // Pre-fill dataset name
      if (phase2.queryPlan?.dataset_name_suggestion) {
        setPhase3({
          datasetName: phase2.queryPlan.dataset_name_suggestion,
        })
      }
      toast.success('Phase 2 confirmed! Moving to dashboard builder.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg)
    } finally {
      setConfirming(false)
    }
  }

  function handleRegenerate() {
    setPhase2({ queryPlan: null, qaReport: null, editedSql: '', confirmed: false })
    reset()
  }

  function handleCopyName() {
    if (phase2.queryPlan?.dataset_name_suggestion) {
      navigator.clipboard
        .writeText(phase2.queryPlan.dataset_name_suggestion)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => toast.error('Failed to copy to clipboard'))
    }
  }

  const qp = phase2.queryPlan as QueryPlan | null
  const qa = phase2.qaReport as DatasetQAReport | null

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl w-full mx-auto">
      {/* Header */}
      <SectionHeader
        eyebrow="Phase 2"
        title="Query Builder"
        subtitle="Generate a master JOIN SQL query from your schema."
      />

      {/* Generate button */}
      <Zone label="Generate">
        <div className="p-4 flex items-center gap-3">
          <Button
            variant="primary"
            icon={<Zap size={15} />}
            loading={isStreaming}
            onClick={handleGenerate}
          >
            {isStreaming ? 'Generating...' : 'Generate Query'}
          </Button>
          {qp && (
            <Button
              variant="secondary"
              icon={<RefreshCw size={14} />}
              onClick={handleRegenerate}
            >
              Re-generate
            </Button>
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
        {qp && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* QA Status */}
            {qa && (
              <div
                className={`flex items-start gap-3 rounded-xl border p-4 ${
                  qa.passed
                    ? 'border-success/30 bg-success/10'
                    : 'border-error/30 bg-error/10'
                }`}
              >
                {qa.passed ? (
                  <CheckCircle2 size={18} className="text-success mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-error mt-0.5 shrink-0" />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        qa.passed ? 'text-success' : 'text-error'
                      }`}
                    >
                      {qa.passed ? 'QA Passed' : 'QA Issues Found'}
                    </span>
                    <Badge variant="muted">
                      {qa.row_count.toLocaleString()} rows
                    </Badge>
                    {qa.duplicate_row_count > 0 && (
                      <Badge variant="error">
                        {qa.duplicate_row_count} duplicates
                      </Badge>
                    )}
                  </div>
                  {qa.issues.length > 0 && (
                    <ul className="space-y-1">
                      {qa.issues.map((issue, i) => (
                        <li key={i} className="text-xs text-error">
                          • {issue}
                        </li>
                      ))}
                    </ul>
                  )}
                  {qa.suggestions.length > 0 && (
                    <ul className="space-y-1">
                      {qa.suggestions.map((s, i) => (
                        <li key={i} className="text-xs text-warning">
                          → {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Agent reasoning */}
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
                    {qp.agent_reasoning}
                  </p>
                </div>
              )}
            </Zone>

            {/* Grain */}
            {qp.grain_description && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
                <Info size={14} className="text-accent shrink-0" />
                <span className="text-xs text-text-muted">
                  <strong className="text-text">Grain: </strong>
                  {qp.grain_description}
                </span>
              </div>
            )}

            {/* SQL Editor */}
            <Zone label="SQL Query (editable)">
              <div className="overflow-hidden rounded-b-[14px]">
                <CodeMirror
                  value={localSql}
                  height="300px"
                  extensions={[sql()]}
                  theme={theme === 'dark' ? dracula : defaultLightThemeOption}
                  onChange={(val) => {
                    setLocalSql(val)
                    setPhase2({ editedSql: val })
                  }}
                  style={{ fontSize: 12 }}
                />
              </div>
            </Zone>

            {/* Calculated columns */}
            {qp.calculated_columns.length > 0 && (
              <Zone label="Calculated Columns">
                <div className="flex flex-wrap gap-2 p-4">
                  {qp.calculated_columns.map((col, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                    >
                      <span className="font-mono font-semibold text-accent">
                        {col.name}
                      </span>
                      {col.description && (
                        <p className="mt-0.5 text-text-muted">{col.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Zone>
            )}

            {/* Sample data */}
            {qa && qa.sample_rows.length > 0 && (
              <Zone label="Sample Data (5 rows)">
                <div className="p-4">
                  <DataTable
                    columns={Object.keys(qa.sample_rows[0])}
                    rows={qa.sample_rows as Record<string, unknown>[]}
                    maxRows={5}
                  />
                </div>
              </Zone>
            )}

            {/* Instructions */}
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
              <p className="text-sm font-semibold text-accent">
                Next: Create Dataset in Superset SQL Lab
              </p>
              <ol className="space-y-1 text-xs text-text-muted list-decimal list-inside">
                <li>
                  Open Superset → SQL Lab → SQL Editor
                </li>
                <li>Paste the SQL above and run it to verify</li>
                <li>
                  Click "Save Dataset" and name it:{' '}
                  <span className="font-mono text-accent">
                    {qp.dataset_name_suggestion}
                  </span>
                </li>
                <li>Then come back here and click "Confirm"</li>
              </ol>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-text-muted">Dataset name:</span>
                <code className="font-mono text-xs text-accent bg-accent/10 px-2 py-0.5 rounded">
                  {qp.dataset_name_suggestion}
                </code>
                <button
                  onClick={handleCopyName}
                  className="text-text-muted hover:text-text transition-colors"
                >
                  {copied ? (
                    <CheckCircle2 size={13} className="text-success" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                icon={<ArrowRight size={15} />}
                loading={confirming}
                onClick={handleConfirm}
              >
                Confirm & Go to Phase 3
              </Button>
              <Button
                variant="secondary"
                icon={<RefreshCw size={14} />}
                onClick={handleRegenerate}
              >
                Re-generate
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
