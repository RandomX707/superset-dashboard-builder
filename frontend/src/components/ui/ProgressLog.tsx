import { useEffect, useRef } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface LogEntry {
  message: string
  timestamp: string
}

interface ProgressLogProps {
  logs: LogEntry[]
  isStreaming: boolean
  isDone: boolean
  error: string | null
  label?: string
}

export function ProgressLog({
  logs,
  isStreaming,
  isDone,
  error,
  label = 'agent output',
}: ProgressLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (!isStreaming && !isDone && !error && logs.length === 0) return null

  return (
    <div className="terminal overflow-hidden">
      {/* Chrome header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <span className="flex-1 text-center text-[10px] font-semibold uppercase tracking-wider text-text-dim">
          {label}
        </span>
        {isStreaming && (
          <div className="flex items-center gap-1">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" style={{ animationDelay: '200ms' }} />
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" style={{ animationDelay: '400ms' }} />
          </div>
        )}
      </div>

      {/* Log lines */}
      <div className="max-h-48 overflow-y-auto space-y-1 p-3">
        <AnimatePresence initial={false}>
          {logs.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2"
            >
              <span className="shrink-0 text-accent select-none">›</span>
              <span
                className={
                  i === logs.length - 1 && isStreaming
                    ? 'text-text'
                    : 'text-text-muted'
                }
              >
                {log.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {isDone && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-success"
          >
            <CheckCircle2 size={13} />
            <span>Done</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 text-error"
          >
            <XCircle size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
