import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from './store/appStore'
import { createSession, getDefaults, updateConfig, ApiError } from './api/client'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Phase1 } from './components/phases/Phase1'
import { Phase2 } from './components/phases/Phase2'
import { Phase3 } from './components/phases/Phase3'
import { AuditPanel } from './components/ui/AuditPanel'
import { VersionHistoryPanel } from './components/ui/VersionHistoryPanel'

function PhaseContent() {
  const { activePhase } = useAppStore()

  return (
    <div className="flex-1 overflow-y-auto">
      <AnimatePresence mode="wait">
        {activePhase === 1 && (
          <motion.div
            key="phase1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <Phase1 />
          </motion.div>
        )}
        {activePhase === 2 && (
          <motion.div
            key="phase2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <Phase2 />
          </motion.div>
        )}
        {activePhase === 3 && (
          <motion.div
            key="phase3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <Phase3 />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  const {
    sessionId,
    setSessionId,
    theme,
    dbConfig,
    supersetConfig,
    llmModel,
    setSupersetConfig,
    setLlmModel,
    versionHistory,
    setVersionPanelOpen,
  } = useAppStore()

  // Sync theme class to <html>
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    async function init() {
      let sid = sessionId
      let nextSupersetConfig = supersetConfig
      let nextLlmModel = llmModel

      try {
        const defaults = await getDefaults()
        if (!nextSupersetConfig.url || nextSupersetConfig.url === 'http://localhost:8088') {
          nextSupersetConfig = {
            ...nextSupersetConfig,
            url: defaults.superset_url,
            username: defaults.superset_username,
          }
          setSupersetConfig(nextSupersetConfig)
        }
        if (!nextLlmModel) {
          nextLlmModel = defaults.llm_model
          setLlmModel(nextLlmModel)
        }
      } catch {
        // silently ignore
      }

      // If we have a stored session, verify it still exists on the server.
      // The server is in-memory, so a restart wipes all sessions.
      if (sid) {
        try {
          await updateConfig(sid, {
            db: { ...dbConfig },
            superset: { ...nextSupersetConfig },
            llm_model: nextLlmModel,
          })
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            // Session gone (server restarted) — create a fresh one
            sid = null
            setSessionId('')
          }
        }
      }

      // Create a new session if we don't have a valid one
      if (!sid) {
        try {
          const res = await createSession()
          sid = res.session_id
          setSessionId(sid)
          await updateConfig(sid, {
            db: { ...dbConfig },
            superset: { ...nextSupersetConfig },
            llm_model: nextLlmModel,
          })
        } catch (e) {
          console.error('Failed to create session:', e)
          return
        }
      }

    }

    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen bg-bg text-text font-sans overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <PhaseContent />
      </main>
      <AuditPanel />
      {versionHistory.panelOpen && sessionId && (
        <VersionHistoryPanel
          sessionId={sessionId}
          onClose={() => setVersionPanelOpen(false)}
        />
      )}
    </div>
  )
}
