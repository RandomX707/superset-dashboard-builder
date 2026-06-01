import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Link2,
  Plus,
} from 'lucide-react'
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { ErdColumn, ErdData, ErdTableNode } from '../../types'

interface Props {
  erdData: ErdData
  sessionId: string
  onAddExcludedTable: (tableName: string) => void
}

interface TableNodeData extends ErdTableNode {
  onAddTable: (tableName: string) => void
}

function ColumnIcon({ column }: { column: ErdColumn }) {
  if (column.is_pk) return <KeyRound size={11} className="erd-col-icon-primary" />
  if (column.is_fk) return <Link2 size={11} className="erd-col-icon-fk" />
  if (column.is_date) return <CalendarDays size={11} className="erd-col-icon-date" />
  return <span className="erd-col-dot">.</span>
}

function formatType(type: string): string {
  return type.toLowerCase().replace('character varying', 'varchar').slice(0, 12)
}

function TableNode({ data }: NodeProps<TableNodeData>) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      className={`erd-table-node ${data.is_primary ? 'is-primary' : ''} ${
        !data.is_selected ? 'is-excluded' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <button className="erd-table-header" onClick={() => setExpanded((v) => !v)}>
        <span className="erd-table-name">{data.table_name}</span>
        {data.is_primary && <span className="erd-primary-badge">fact</span>}
        {data.row_count != null && (
          <span className="erd-row-count">{data.row_count.toLocaleString()} rows</span>
        )}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && data.columns.length > 0 && (
        <div className="erd-column-list">
          {data.columns.map((column) => (
            <div
              key={column.name}
              className={`erd-column-row ${column.is_pk ? 'is-pk' : ''} ${
                column.is_fk ? 'is-fk' : ''
              } ${column.is_date ? 'is-date' : ''}`}
              title={`${column.type} | null: ${column.null_pct.toFixed(1)}%`}
            >
              <ColumnIcon column={column} />
              <span className="erd-col-name">{column.name}</span>
              <span className="erd-col-type">{formatType(column.type)}</span>
              {column.null_pct > 10 && (
                <span className="erd-null-warning" title={`${column.null_pct.toFixed(0)}% null`}>
                  !
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {!data.is_selected && (
        <button
          className="erd-add-table-btn"
          onClick={() => data.onAddTable(data.table_name)}
        >
          <Plus size={11} />
          Add to schema
        </button>
      )}

      {expanded && data.columns.length === 0 && !data.is_selected && (
        <p className="erd-empty-hint">Click add to profile columns</p>
      )}
    </div>
  )
}

function buildNodes(
  erdData: ErdData,
  onAddExcludedTable: (tableName: string) => void
): Node<TableNodeData>[] {
  const nodes: Node<TableNodeData>[] = []
  const selected = erdData.selected_nodes
  const excluded = erdData.excluded_nodes
  const dimTables = selected.filter((t) => t.table_name !== erdData.suggested_primary)

  selected.forEach((table) => {
    let x = 400
    let y = 250

    if (table.table_name !== erdData.suggested_primary) {
      const dimIdx = dimTables.findIndex((t) => t.table_name === table.table_name)
      const angle = (2 * Math.PI * dimIdx) / Math.max(dimTables.length, 1)
      const radius = 380
      x = 400 + radius * Math.cos(angle)
      y = 250 + radius * Math.sin(angle) * 0.7
    }

    nodes.push({
      id: table.table_name,
      type: 'tableNode',
      position: { x, y },
      data: { ...table, onAddTable: () => undefined },
    })
  })

  excluded.forEach((table, i) => {
    nodes.push({
      id: table.table_name,
      type: 'tableNode',
      position: { x: 80 + i * 210, y: 680 },
      data: { ...table, onAddTable: onAddExcludedTable },
      style: { opacity: 0.55 },
    })
  })

  return nodes
}

function buildEdges(erdData: ErdData): Edge[] {
  return erdData.edges.map((edge, i) => ({
    id: `edge-${i}`,
    source: edge.source_table,
    target: edge.target_table,
    label: `${edge.source_col} → ${edge.target_col}`,
    labelStyle: { fontSize: 10, fill: 'var(--color-text-dim)' },
    labelBgStyle: { fill: 'var(--color-bg)', fillOpacity: 0.85 },
    style: { stroke: '#1D9E75', strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 12,
      height: 12,
      color: '#1D9E75',
    },
  }))
}

export function ERDDiagram({ erdData, sessionId, onAddExcludedTable }: Props) {
  const nodeTypes = useMemo(() => ({ tableNode: TableNode }), [])
  const initialNodes = useMemo(
    () => buildNodes(erdData, onAddExcludedTable),
    [erdData, onAddExcludedTable]
  )
  const initialEdges = useMemo(() => buildEdges(erdData), [erdData])
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(buildNodes(erdData, onAddExcludedTable))
    setEdges(buildEdges(erdData))
  }, [erdData, onAddExcludedTable, setEdges, setNodes])

  return (
    <div className="erd-shell" data-session-id={sessionId}>
      <style>{`
        .erd-shell {
          width: 100%;
          height: 520px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
          background: var(--color-bg);
        }
        .erd-table-node {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          min-width: 220px;
          max-width: 280px;
          font-size: 12px;
          color: var(--color-text);
          box-shadow: 0 8px 22px rgba(0,0,0,0.16);
        }
        .erd-table-node.is-primary {
          border-color: #1D9E75;
          border-width: 2px;
        }
        .erd-table-node.is-excluded {
          border-style: dashed;
        }
        .erd-table-header {
          width: 100%;
          padding: 8px 10px;
          background: var(--color-card);
          border-radius: 8px 8px 0 0;
          display: flex;
          align-items: center;
          gap: 6px;
          text-align: left;
        }
        .erd-table-name {
          font-weight: 700;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .erd-primary-badge {
          background: rgba(29,158,117,0.15);
          color: #1D9E75;
          padding: 1px 6px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
        }
        .erd-row-count {
          color: var(--color-text-dim);
          font-size: 10px;
          white-space: nowrap;
        }
        .erd-column-list {
          padding: 4px 0;
          max-height: 220px;
          overflow-y: auto;
        }
        .erd-column-row {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          font-size: 11px;
        }
        .erd-column-row:hover {
          background: var(--color-card);
        }
        .erd-column-row.is-pk .erd-col-name {
          font-weight: 700;
        }
        .erd-column-row.is-fk .erd-col-name,
        .erd-col-icon-fk {
          color: #534AB7;
        }
        .erd-col-icon-primary {
          color: #1D9E75;
        }
        .erd-col-icon-date {
          color: #BA7517;
        }
        .erd-col-dot {
          width: 11px;
          color: var(--color-text-dim);
          text-align: center;
        }
        .erd-col-name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .erd-col-type {
          color: var(--color-text-dim);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10px;
        }
        .erd-null-warning {
          color: #BA7517;
          font-weight: 800;
        }
        .erd-add-table-btn {
          width: 100%;
          padding: 7px;
          border-top: 1px solid var(--color-border);
          color: #1D9E75;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
        }
        .erd-add-table-btn:hover {
          background: rgba(29,158,117,0.12);
        }
        .erd-empty-hint {
          padding: 8px 10px;
          font-size: 11px;
          color: var(--color-text-dim);
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        attributionPosition="bottom-right"
      >
        <Background color="var(--color-border)" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) =>
            node.data.is_primary
              ? '#1D9E75'
              : node.data.is_selected
              ? 'var(--color-border)'
              : '#9c9a8c'
          }
          style={{ background: 'var(--color-card)' }}
        />
      </ReactFlow>
    </div>
  )
}
