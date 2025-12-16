import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { buildGraph, type GraphNode, type GraphEdge } from "./buildGraph";
import type { JsonSchema } from "../schema/types";
import { Box, Paper, Typography, useTheme } from "@mui/material";
import type { EntityNodeData } from "./types";

type SchemaERDProps = {
  schema: JsonSchema;
  data: Record<string, unknown>;
  onNavigate?: (path: string) => void;
};

function onAttrClickFactory(
  path: string | undefined,
  onNavigate?: (p: string) => void,
) {
  function onAttrClick() {
    if (path && onNavigate) onNavigate(path);
  }
  return onAttrClick;
}

function EntityNode({ data }: { data: GraphNode["data"] }) {
  const theme = useTheme();
  const border = data.exists
    ? theme.palette.primary.main
    : theme.palette.divider;
  const bg = data.exists
    ? theme.palette.mode === "dark"
      ? "rgba(138,180,248,0.08)"
      : "rgba(26,115,232,0.06)"
    : theme.palette.background.paper;
  function renderAttr(attr: {
    name: string;
    type: string;
    required?: boolean;
    isArray?: boolean;
    path?: string;
  }) {
    return (
      <li
        key={attr.name}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          lineHeight: 1.6,
          padding: "4px 0",
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
          }}
        >
          <Typography
            component="span"
            sx={{
              cursor: attr.path ? "pointer" : "default",
              "&:hover": { textDecoration: attr.path ? "underline" : "none" },
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            onClick={onAttrClickFactory(attr.path, data.onNavigate)}
          >
            {attr.name}
            {attr.isArray ? " []" : ""}
          </Typography>
          <Typography component="span" sx={{ opacity: 0.7, fontSize: 12 }}>
            : {attr.type}
          </Typography>
          {attr.required ? (
            <Typography
              component="span"
              sx={{ color: "error.main", fontSize: 12 }}
            >
              *
            </Typography>
          ) : null}
        </Box>
      </li>
    );
  }
  return (
    <Paper
      elevation={2}
      sx={{
        p: 0,
        minWidth: 220,
        border: `1px solid ${border}`,
        background: bg,
        position: "relative",
        overflow: "hidden",
        borderRadius: 1.25,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: border }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: border }}
      />
      <Box
        sx={{
          px: 1.25,
          py: 1,
          borderBottom: "1px solid",
          borderColor: border,
          display: "flex",
          alignItems: "center",
          gap: 1,
          justifyContent: "space-between",
        }}
      >
        <Box
          sx={{
            width: 4,
            alignSelf: "stretch",
            bgcolor: border,
            borderRadius: 2,
          }}
        />
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, flex: 1, ml: 1 }}
          noWrap
        >
          {data.title}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          {data.requiredCount > 0 ? `${data.requiredCount} req` : ""}
        </Typography>
      </Box>
      <Box sx={{ px: 1.25, py: 1 }}>
        {data.attributes.length > 0 ? (
          <ul style={{ paddingLeft: 0, margin: 0, listStyle: "none" }}>
            {data.attributes.slice(0, 10).map(renderAttr)}
            {data.attributes.length > 10 && (
              <li style={{ listStyle: "none", fontSize: 12, opacity: 0.7 }}>
                +{data.attributes.length - 10} more…
              </li>
            )}
          </ul>
        ) : (
          <Typography variant="caption" color="text.secondary">
            No primitive attributes
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

function NodeEntityRenderer({ data }: { data: GraphNode["data"] }) {
  return <EntityNode data={data} />;
}

const nodeTypes = { entity: NodeEntityRenderer };

function layoutGraph(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(function () {
    return {};
  });
  // Increase spacing and assume larger node sizes to prevent overlaps for nodes with many fields
  g.setGraph({
    rankdir: "TB",
    nodesep: 80,
    ranksep: 160,
    marginx: 60,
    marginy: 60,
  });
  nodes.forEach(function (n) {
    g.setNode(n.id, { width: n.width ?? 260, height: n.height ?? 220 });
  });
  edges.forEach(function (e) {
    g.setEdge(e.source, e.target);
  });
  dagre.layout(g);
  const laidOut = nodes.map(function (n) {
    const coord = g.node(n.id) as { x: number; y: number } | undefined;
    if (coord) {
      n.position = {
        x: coord.x - (n.width ?? 260) / 2,
        y: coord.y - (n.height ?? 220) / 2,
      };
    }
    return n;
  });
  return { nodes: laidOut, edges };
}

export function SchemaERD({ schema, data, onNavigate }: SchemaERDProps) {
  const graph = useMemo(
    function () {
      return buildGraph(schema, data);
    },
    [schema, data],
  );

  const mapInitialNode = useCallback(
    (n: GraphNode): Node => {
      return {
        id: n.id === "" ? "root" : n.id,
        type: "entity",
        data: { ...n.data, onNavigate } as EntityNodeData,
        position: { x: 0, y: 0 },
      };
    },
    [onNavigate],
  );

  const initialNodes: Node[] = useMemo(() => {
    return graph.nodes.map<Node>(mapInitialNode);
  }, [graph.nodes, mapInitialNode]);

  function mapInitialEdge(e: GraphEdge): Edge {
    return {
      id: e.id,
      source: e.source === "" ? "root" : e.source,
      target: e.target === "" ? "root" : e.target,
      label: e.data.label,
      animated: false,
    };
  }
  const initialEdges: Edge[] = useMemo(
    function () {
      return graph.edges.map<Edge>(mapInitialEdge);
    },
    [graph.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(
    function () {
      // re-layout when graph changes
      const { nodes: n, edges: e } = layoutGraph(
        [...initialNodes],
        [...initialEdges],
      );
      setNodes(n);
      setEdges(e);
    },
    [initialNodes, initialEdges, setNodes, setEdges],
  );

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ height: "100%", width: "100%" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onlyRenderVisibleElements={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{ type: "step" }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default SchemaERD;
