import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Database,
  Globe,
  Cpu,
  ChevronDown,
  ChevronRight,
  BarChart3,
  ScrollText,
  Download,
  History,
} from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { updateConfig, testDbConnection } from '../../api/client'
import { Input, Select, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { exportAuditJSON } from '../ui/AuditPanel'

const DB_PORTS: Record<string, number> = {
  postgresql: 5432,
  mysql: 3306,
  mongodb: 27017,
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border">
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  success: '#1D9E75',
  warning: '#BA7517',
  error: '#E24B4A',
  info: '#64748b',
}

export function Sidebar() {
  const {
    sessionId,
    activePhase,
    dbConfig,
    supersetConfig,
    llmModel,
    setDbConfig,
    setSupersetConfig,
    setLlmModel,
    dbConnected,
    setDbConnected,
    auditEntries,
    setAuditPanelOpen,
    fetchAuditLog,
    setVersionPanelOpen,
    fetchAllDashboardHistory,
  } = useAppStore()

  const [testingDb, setTestingDb] = useState(false)
  const [dbStatus, setDbStatus] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncConfig = useCallback(() => {
    if (!sessionId) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      updateConfig(sessionId, {
        db: { ...dbConfig },
        superset: { ...supersetConfig },
        llm_model: llmModel,
      }).catch(() => {/* silent */})
    }, 500)
  }, [sessionId, dbConfig, supersetConfig, llmModel])

  useEffect(() => {
    syncConfig()
  }, [dbConfig, supersetConfig, llmModel, syncConfig])

  async function handleTestDb() {
    if (!sessionId) return
    setTestingDb(true)
    try {
      // Sync immediately before test
      await updateConfig(sessionId, {
        db: { ...dbConfig },
      })
      const result = await testDbConnection(sessionId)
      if (result.ok) {
        setDbStatus('ok')
        setDbConnected(true)
        toast.success('Connected to database')
      } else {
        setDbStatus('fail')
        setDbConnected(false)
        toast.error(result.message)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setDbStatus('fail')
      setDbConnected(false)
      toast.error(msg)
    } finally {
      setTestingDb(false)
    }
  }

  function handleDbTypeChange(type: string) {
    const newPort = DB_PORTS[type] ?? dbConfig.port
    setDbConfig({ ...dbConfig, type: type as typeof dbConfig.type, port: newPort })
    setDbStatus('unknown')
    setDbConnected(false)
  }

  return (
    <aside className="flex h-full w-[288px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl shadow-sm"
          style={{ background: 'var(--grad-brand)' }}
        >
          <BarChart3 size={16} className="text-[#0e0d0a]" strokeWidth={2.5} />
        </div>
        <span
          className="text-sm font-bold tracking-wide bg-clip-text text-transparent"
          style={{ backgroundImage: 'var(--grad-brand)' }}
        >
          DATA VIZ
        </span>
      </div>

      {/* DB Connection */}
      <CollapsibleSection
        title="Database"
        icon={<Database size={13} />}
        defaultOpen={true}
      >
        {activePhase === 3 && (
          <p className="text-xs text-text-dim mt-1">
            Not required for dashboard building
          </p>
        )}
        <Select
          label="Type"
          value={dbConfig.type}
          options={[
            { value: 'postgresql', label: 'PostgreSQL' },
            { value: 'mysql', label: 'MySQL' },
            { value: 'mongodb', label: 'MongoDB' },
          ]}
          onChange={(e) => handleDbTypeChange(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Host"
            value={dbConfig.host}
            onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
            placeholder="localhost"
          />
          <Input
            label="Port"
            type="number"
            value={dbConfig.port}
            onChange={(e) =>
              setDbConfig({ ...dbConfig, port: parseInt(e.target.value) || 5432 })
            }
          />
        </div>
        <Input
          label="Database"
          value={dbConfig.database}
          onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
          placeholder="mydb"
        />
        <Input
          label="Username"
          value={dbConfig.username}
          onChange={(e) => setDbConfig({ ...dbConfig, username: e.target.value })}
          placeholder="postgres"
        />
        <Input
          label="Password"
          type="password"
          value={dbConfig.password}
          onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
          placeholder="••••••••"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={testingDb}
            onClick={handleTestDb}
            className="flex-1"
          >
            Test Connection
          </Button>
          {dbStatus !== 'unknown' && (
            <Badge variant={dbStatus === 'ok' ? 'success' : 'error'}>
              {dbStatus === 'ok' ? 'Connected' : 'Failed'}
            </Badge>
          )}
          {dbStatus === 'unknown' && !dbConnected && (
            <Badge variant="muted">Not tested</Badge>
          )}
        </div>
      </CollapsibleSection>

      {/* Superset */}
      <CollapsibleSection
        title="Superset"
        icon={<Globe size={13} />}
        defaultOpen={false}
      >
        <Input
          label="URL"
          value={supersetConfig.url}
          onChange={(e) =>
            setSupersetConfig({ ...supersetConfig, url: e.target.value })
          }
          placeholder="http://localhost:8088"
        />
        <Input
          label="Username"
          value={supersetConfig.username}
          onChange={(e) =>
            setSupersetConfig({ ...supersetConfig, username: e.target.value })
          }
          placeholder="admin"
        />
        <Input
          label="Password"
          type="password"
          value={supersetConfig.password}
          onChange={(e) =>
            setSupersetConfig({ ...supersetConfig, password: e.target.value })
          }
          placeholder="••••••••"
        />
        <Textarea
          label="Session Cookie (for SSO/Keycloak)"
          rows={3}
          value={supersetConfig.session_cookie ?? ''}
          onChange={(e) =>
            setSupersetConfig({ ...supersetConfig, session_cookie: e.target.value })
          }
          placeholder="Paste the 'session' cookie value from browser DevTools"
        />
        <Input
          label="CSRF Token (for SSO/Keycloak)"
          value={supersetConfig.csrf_token ?? ''}
          onChange={(e) =>
            setSupersetConfig({ ...supersetConfig, csrf_token: e.target.value })
          }
          placeholder="Paste X-CSRFToken header value"
        />
      </CollapsibleSection>

      {/* LLM */}
      <CollapsibleSection
        title="LLM"
        icon={<Cpu size={13} />}
        defaultOpen={false}
      >
        <Input
          label="Model"
          value={llmModel}
          onChange={(e) => setLlmModel(e.target.value)}
          placeholder="claude-haiku-4-5"
        />
      </CollapsibleSection>

      {/* Audit log compact section */}
      <div className="border-t border-border mt-auto">
        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
          <ScrollText size={12} className="text-text-muted" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex-1">
            Audit Log
          </span>
          {auditEntries.length > 0 && (
            <button
              onClick={() => exportAuditJSON(auditEntries)}
              className="text-text-dim hover:text-text-muted transition-colors"
              title="Export JSON"
            >
              <Download size={12} />
            </button>
          )}
        </div>

        <div className="px-4 pb-3 space-y-1.5">
          {auditEntries.length === 0 ? (
            <p className="text-xs text-text-dim">No activity yet</p>
          ) : (
            ([1, 2, 3] as const).map((phase) => {
              const phaseEntries = auditEntries.filter((e) => e.phase === phase)
              if (phaseEntries.length === 0) return null
              const lastEntry = phaseEntries[phaseEntries.length - 1]
              const hasError = phaseEntries.some((e) => e.status === 'error')
              const hasWarning = phaseEntries.some((e) => e.status === 'warning')
              const dotStatus = hasError ? 'error' : hasWarning ? 'warning' : 'success'
              return (
                <div key={phase} className="flex items-start gap-2">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: STATUS_COLORS[dotStatus],
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-text-muted">
                      Phase {phase}
                    </p>
                    <p className="text-[10px] text-text-dim truncate">
                      {lastEntry.title}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => {
              setAuditPanelOpen(true)
              void fetchAuditLog()
            }}
            className="flex-1 rounded border border-border px-2 py-1.5 text-[11px] text-text-muted hover:text-text hover:border-text-dim transition-colors"
          >
            View full log
          </button>
        </div>

        <div className="px-4 pb-3">
          <button
            onClick={() => {
              setVersionPanelOpen(true)
              void fetchAllDashboardHistory()
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-[11px] text-text-muted hover:text-text hover:border-text-dim transition-colors"
          >
            <History size={12} />
            Version history
          </button>
        </div>
      </div>

      {/* DB status indicator */}
      <div className="p-4 border-t border-border">
        <div
          className={clsx(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
            dbConnected
              ? 'bg-success/10 text-success'
              : 'bg-border text-text-muted'
          )}
        >
          <span
            className={clsx(
              'h-2 w-2 rounded-full',
              dbConnected ? 'bg-success animate-pulse' : 'bg-text-dim'
            )}
          />
          {dbConnected ? 'DB Connected' : 'DB not connected'}
        </div>
      </div>
    </aside>
  )
}
