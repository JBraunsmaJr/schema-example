import React, { useEffect, useMemo } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { buildGraph, type GraphEdge, type GraphNode } from './buildGraph'
import type { JsonSchema } from '../schema/types'
import { Paper, Typography, useTheme } from '@mui/material'

type SchemaERDProps = {
  schema: JsonSchema
  data: Record<string, unknown>
}

const EntityNode: React.FC<{ data: GraphNode['data'] }> = ({ data }) => {
  const theme = useTheme()
  const border = data.exists ? theme.palette.primary.main : theme.palette.divider
  const bg = data.exists ? (theme.palette.mode === 'dark' ? 'rgba(138,180,248,0.06)' : 'rgba(26,115,232,0.06)') : theme.palette.background.paper
  return (
    <Paper elevation={1} sx={{ p: 1.25, minWidth: 200, maxWidth: 320, border: `1px solid ${border}`, background: bg }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {data.title}
      </Typography>
      {data.attributes.length > 0 ? (
        <ul style={{ paddingLeft: 16, margin: 0 }}>
          {data.attributes.slice(0, 8).map(attr => (
            <li key={attr.name} style={{ listStyle: 'disc', fontSize: 12, lineHeight: 1.4 }}>
              {attr.name}
              {attr.isArray ? ' []' : ''}
              <span style={{ opacity: 0.7 }}>:{' '}{attr.type}</span>
              {attr.required ? ' *' : ''}
            </li>
          ))}
          {data.attributes.length > 8 && (
            <li style={{ listStyle: 'none', fontSize: 12, opacity: 0.7 }}>+{data.attributes.length - 8} more…</li>
          )}
        </ul>
      ) : (
        <Typography variant="caption" color="text.secondary">No primitive attributes</Typography>
      )}
    </Paper>
  )
}

const nodeTypes = { entity: ({ data }: { data: GraphNode['data'] }) => <EntityNode data={data} /> }

const layoutGraph = (nodes: Node[], edges: Edge[]) => {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 60, marginx: 20, marginy: 20 })
  nodes.forEach((n) => g.setNode(n.id, { width: (n.width ?? 220), height: (n.height ?? 120) }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  const laidOut = nodes.map((n) => {
    const coord = g.node(n.id) as { x: number; y: number } | undefined
    if (coord) {
      n.position = { x: coord.x - (n.width ?? 220) / 2, y: coord.y - (n.height ?? 120) / 2 }
    }
    return n
  })
  return { nodes: laidOut, edges }
}

export const SchemaERD: React.FC<SchemaERDProps> = ({ schema, data }) => {
  const graph = useMemo(() => buildGraph(schema, data), [schema, data])

  const initialNodes: Node[] = useMemo(() => graph.nodes.map<Node>((n) => ({
    id: n.id === '' ? 'root' : n.id,
    type: 'entity',
    data: n.data,
    position: { x: 0, y: 0 }
  })), [graph.nodes])

  const initialEdges: Edge[] = useMemo(() => graph.edges.map<Edge>((e) => ({
    id: e.id,
    source: e.source === '' ? 'root' : e.source,
    target: e.target === '' ? 'root' : e.target,
    label: e.data.label,
    animated: false
  })), [graph.edges])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    // re-layout when graph changes
    const { nodes: n, edges: e } = layoutGraph([...initialNodes], [...initialEdges])
    setNodes(n)
    setEdges(e)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  return (
    <div style={{ height: 700, width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  )
}

export default SchemaERD
