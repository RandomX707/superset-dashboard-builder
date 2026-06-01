import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DbConfig,
  SupersetConfig,
  SchemaMap,
  QueryPlan,
  DatasetQAReport,
  DatasetInfo,
  DashboardPlan,
  QAReport,
  ExcludedTable,
  AuditEntry,
  ChartSpec,
  CsvSession,
  CsvChart,
  DataQualityReport,
  DashboardHistory,
  DashboardHistorySummary,
  VersionSnapshot,
  ErdData,
  ChartDescriptionResult,
} from '../types'
import { getAuditLog, getDashboardHistory, getDashboardHistoryList } from '../api/client'

interface Phase1State {
  schemaMap: SchemaMap | null
  confirmed: boolean
  excludedTables: Record<string, ExcludedTable>
}

interface Phase2State {
  queryPlan: QueryPlan | null
  qaReport: DatasetQAReport | null
  editedSql: string
  confirmed: boolean
}

interface Phase3State {
  datasetName: string
  dashboardTitle: string
  requirements: string
  dashboardId: number | null
  datasetInfo: DatasetInfo | null
  dashboardPlan: DashboardPlan | null
  planReady: boolean
  dashboardUrl: string | null
  chartIds: number[]
  qaReport: QAReport | null
}

interface AppState {
  sessionId: string | null
  setSessionId: (id: string) => void

  theme: 'dark' | 'light'
  toggleTheme: () => void

  dbConfig: DbConfig
  supersetConfig: SupersetConfig
  llmModel: string
  setDbConfig: (c: DbConfig) => void
  setSupersetConfig: (c: SupersetConfig) => void
  setLlmModel: (m: string) => void

  phase1Prompt: string
  setPhase1Prompt: (p: string) => void

  auditEntries: AuditEntry[]
  auditPanelOpen: boolean
  setAuditEntries: (entries: AuditEntry[]) => void
  appendAuditEntry: (entry: AuditEntry) => void
  setAuditPanelOpen: (open: boolean) => void
  fetchAuditLog: () => Promise<void>

  dbConnected: boolean
  setDbConnected: (v: boolean) => void

  activePhase: 1 | 2 | 3
  setActivePhase: (p: 1 | 2 | 3) => void

  phase1: Phase1State
  setPhase1: (p: Partial<Phase1State>) => void
  erdData: ErdData | null
  erdVisible: boolean
  setErdData: (data: ErdData | null) => void
  setErdVisible: (visible: boolean) => void

  phase2: Phase2State
  setPhase2: (p: Partial<Phase2State>) => void

  phase3: Phase3State
  setPhase3: (p: Partial<Phase3State>) => void
  descriptionGeneration: {
    loading: boolean
    results: ChartDescriptionResult[]
    done: boolean
    error: string | null
  }
  setDescriptionGenerationLoading: (b: boolean) => void
  setDescriptionGenerationResults: (r: ChartDescriptionResult[]) => void
  setDescriptionGenerationDone: (b: boolean) => void
  resetDescriptionGeneration: () => void

  phase3Step: 1 | 2 | 3
  editedPlan: DashboardPlan | null
  setPhase3Step: (step: 1 | 2 | 3) => void
  setEditedPlan: (plan: DashboardPlan | null) => void
  removeChartFromPlan: (chartTitle: string) => void
  updateChartInPlan: (chartTitle: string, updates: Partial<ChartSpec>) => void
  addChartToPlan: (chart: ChartSpec) => void

  csvSession: CsvSession | null
  csvChatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  csvCanvasCharts: CsvChart[]
  setCsvSession: (s: CsvSession | null) => void
  setCsvChatHistory: (h: Array<{ role: 'user' | 'assistant'; content: string }>) => void
  appendCsvChatMessage: (msg: { role: 'user' | 'assistant'; content: string }) => void
  setCsvCanvasCharts: (charts: CsvChart[]) => void
  addCsvCanvasChart: (chart: CsvChart) => void
  removeCsvCanvasChart: (id: string) => void

  dqReport: DataQualityReport | null
  dqLoading: boolean
  setDqReport: (report: DataQualityReport | null) => void
  setDqLoading: (loading: boolean) => void

  versionHistory: {
    allDashboards: DashboardHistorySummary[]
    currentHistory: DashboardHistory | null
    selectedSnapshot: VersionSnapshot | null
    loading: boolean
    panelOpen: boolean
  }
  setVersionPanelOpen: (open: boolean) => void
  setAllDashboardHistory: (d: DashboardHistorySummary[]) => void
  setCurrentHistory: (h: DashboardHistory | null) => void
  setSelectedSnapshot: (s: VersionSnapshot | null) => void
  setVersionHistoryLoading: (b: boolean) => void
  fetchAllDashboardHistory: () => Promise<void>
  loadDashboardHistory: (dashboardId: number) => Promise<void>
}

const DEFAULT_DB_CONFIG: DbConfig = {
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: '',
  username: '',
  password: '',
}

const DEFAULT_SUPERSET_CONFIG: SupersetConfig = {
  url: '',
  username: 'admin',
  password: '',
  session_cookie: '',
  csrf_token: '',
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      setSessionId: (id) => set({ sessionId: id }),

      theme: 'dark',
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      dbConfig: DEFAULT_DB_CONFIG,
      supersetConfig: DEFAULT_SUPERSET_CONFIG,
      llmModel: 'claude-haiku-4-5',
      setDbConfig: (c) => set({ dbConfig: c }),
      setSupersetConfig: (c) => set({ supersetConfig: c }),
      setLlmModel: (m) => set({ llmModel: m }),

      phase1Prompt: '',
      setPhase1Prompt: (p) => set({ phase1Prompt: p }),

      auditEntries: [],
      auditPanelOpen: false,
      setAuditEntries: (entries) => set({ auditEntries: entries }),
      appendAuditEntry: (entry) =>
        set((s) => ({ auditEntries: [...s.auditEntries, entry] })),
      setAuditPanelOpen: (open) => set({ auditPanelOpen: open }),
      fetchAuditLog: async () => {
        const sessionId = get().sessionId
        if (!sessionId) return
        try {
          const log = await getAuditLog(sessionId)
          set({ auditEntries: log.entries })
        } catch {
          // silently ignore — audit is best-effort
        }
      },

      dbConnected: false,
      setDbConnected: (v) => set({ dbConnected: v }),

      activePhase: 1,
      setActivePhase: (p) => set({ activePhase: p }),

      phase1: {
        schemaMap: null,
        confirmed: false,
        excludedTables: {},
      },
      setPhase1: (p) =>
        set((state) => ({ phase1: { ...state.phase1, ...p } })),
      erdData: null,
      erdVisible: false,
      setErdData: (data) => set({ erdData: data }),
      setErdVisible: (visible) => set({ erdVisible: visible }),

      phase2: {
        queryPlan: null,
        qaReport: null,
        editedSql: '',
        confirmed: false,
      },
      setPhase2: (p) =>
        set((state) => ({ phase2: { ...state.phase2, ...p } })),

      phase3: {
        datasetName: '',
        dashboardTitle: '',
        requirements: '',
        dashboardId: null,
        datasetInfo: null,
        dashboardPlan: null,
        planReady: false,
        dashboardUrl: null,
        chartIds: [],
        qaReport: null,
      },
      setPhase3: (p) =>
        set((state) => ({ phase3: { ...state.phase3, ...p } })),
      descriptionGeneration: {
        loading: false,
        results: [],
        done: false,
        error: null,
      },
      setDescriptionGenerationLoading: (loading) =>
        set((s) => ({ descriptionGeneration: { ...s.descriptionGeneration, loading } })),
      setDescriptionGenerationResults: (results) =>
        set((s) => ({
          descriptionGeneration: {
            ...s.descriptionGeneration,
            results,
            error: null,
          },
        })),
      setDescriptionGenerationDone: (done) =>
        set((s) => ({ descriptionGeneration: { ...s.descriptionGeneration, done } })),
      resetDescriptionGeneration: () =>
        set({
          descriptionGeneration: {
            loading: false,
            results: [],
            done: false,
            error: null,
          },
        }),

      phase3Step: 1 as (1 | 2 | 3),
      editedPlan: null,
      setPhase3Step: (step) => set({ phase3Step: step }),
      setEditedPlan: (plan) => set({ editedPlan: plan }),
      removeChartFromPlan: (chartTitle) =>
        set((s) => ({
          editedPlan: s.editedPlan
            ? { ...s.editedPlan, charts: s.editedPlan.charts.filter((c) => c.title !== chartTitle) }
            : null,
        })),
      updateChartInPlan: (chartTitle, updates) =>
        set((s) => ({
          editedPlan: s.editedPlan
            ? { ...s.editedPlan, charts: s.editedPlan.charts.map((c) => c.title === chartTitle ? { ...c, ...updates } : c) }
            : null,
        })),
      addChartToPlan: (chart) =>
        set((s) => ({
          editedPlan: s.editedPlan
            ? { ...s.editedPlan, charts: [...s.editedPlan.charts, chart] }
            : null,
        })),

      csvSession: null,
      csvChatHistory: [],
      csvCanvasCharts: [],
      setCsvSession: (s) => set({ csvSession: s }),
      setCsvChatHistory: (h) => set({ csvChatHistory: h }),
      appendCsvChatMessage: (msg) =>
        set((s) => ({ csvChatHistory: [...s.csvChatHistory, msg] })),
      setCsvCanvasCharts: (charts) => set({ csvCanvasCharts: charts }),
      addCsvCanvasChart: (chart) =>
        set((s) => ({ csvCanvasCharts: [...s.csvCanvasCharts, chart] })),
      removeCsvCanvasChart: (id) =>
        set((s) => ({ csvCanvasCharts: s.csvCanvasCharts.filter((c) => c.id !== id) })),

      dqReport: null,
      dqLoading: false,
      setDqReport: (report) => set({ dqReport: report }),
      setDqLoading: (loading) => set({ dqLoading: loading }),

      versionHistory: {
        allDashboards: [],
        currentHistory: null,
        selectedSnapshot: null,
        loading: false,
        panelOpen: false,
      },
      setVersionPanelOpen: (open) =>
        set((s) => ({ versionHistory: { ...s.versionHistory, panelOpen: open } })),
      setAllDashboardHistory: (d) =>
        set((s) => ({ versionHistory: { ...s.versionHistory, allDashboards: d } })),
      setCurrentHistory: (h) =>
        set((s) => ({ versionHistory: { ...s.versionHistory, currentHistory: h } })),
      setSelectedSnapshot: (snapshot) =>
        set((s) => ({ versionHistory: { ...s.versionHistory, selectedSnapshot: snapshot } })),
      setVersionHistoryLoading: (loading) =>
        set((s) => ({ versionHistory: { ...s.versionHistory, loading } })),
      fetchAllDashboardHistory: async () => {
        const sessionId = get().sessionId
        if (!sessionId) return
        set((s) => ({ versionHistory: { ...s.versionHistory, loading: true } }))
        try {
          const res = await getDashboardHistoryList(sessionId)
          set((s) => ({ versionHistory: { ...s.versionHistory, allDashboards: res.dashboards } }))
        } catch {
          set((s) => ({ versionHistory: { ...s.versionHistory, allDashboards: [] } }))
        } finally {
          set((s) => ({ versionHistory: { ...s.versionHistory, loading: false } }))
        }
      },
      loadDashboardHistory: async (dashboardId) => {
        const sessionId = get().sessionId
        if (!sessionId) return
        set((s) => ({ versionHistory: { ...s.versionHistory, loading: true } }))
        try {
          const history = await getDashboardHistory(sessionId, dashboardId)
          set((s) => ({
            versionHistory: {
              ...s.versionHistory,
              currentHistory: history,
              selectedSnapshot: null,
            },
          }))
        } catch {
          set((s) => ({
            versionHistory: {
              ...s.versionHistory,
              currentHistory: null,
              selectedSnapshot: null,
            },
          }))
        } finally {
          set((s) => ({ versionHistory: { ...s.versionHistory, loading: false } }))
        }
      },
    }),
    {
      name: 'superset-dashboard-builder',
      partialize: (state) => ({
        sessionId: state.sessionId,
        theme: state.theme,
        dbConfig: state.dbConfig,
        supersetConfig: state.supersetConfig,
        llmModel: state.llmModel,
        phase1Prompt: state.phase1Prompt,
      }),
    }
  )
)
