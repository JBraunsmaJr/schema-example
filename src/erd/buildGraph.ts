import type { JsonSchema, SchemaField } from "../schema/types"
import type { EdgeData, NodeData, EntityNodeData, Attribute, Cardinality } from "./types"

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const joinPath = (path: (string | number)[]) => path.map(p => String(p)).join('.')

const itemPathToken = '[]'

const hasAnyValue = (schemaNode: SchemaField | JsonSchema, dataNode: unknown): boolean => {
  const t = (schemaNode as SchemaField).type ?? 'object'
  switch (t) {
    case 'string': return typeof dataNode === 'string' && dataNode.length > 0
    case 'number':
    case 'integer': return typeof dataNode === 'number' && !Number.isNaN(dataNode)
    case 'boolean': return typeof dataNode === 'boolean'
    case 'array': return Array.isArray(dataNode) && dataNode.length > 0
    case 'object': {
      if (!isRecord(dataNode)) return false
      const props = (schemaNode as { properties?: Record<string, SchemaField> }).properties
      if (!props) return Object.keys(dataNode).length > 0
      for (const k of Object.keys(props)) {
        if (hasAnyValue(props[k], dataNode[k])) return true
      }
      return false
    }
    default:
      return false
  }
}

export interface GraphNode { id: string; data: NodeData }
export interface GraphEdge { id: string; source: string; target: string; data: EdgeData }
export interface SchemaGraph { nodes: GraphNode[]; edges: GraphEdge[] }

export function buildGraph(schema: JsonSchema, data: Record<string, unknown>): SchemaGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  const makeEntity = (
    title: string,
    schemaNode: SchemaField | JsonSchema,
    path: (string | number)[],
    dataNode: unknown
  ): EntityNodeData => {
    const t = (schemaNode as SchemaField).type ?? 'object'
    const id = joinPath(path)
    const props = t === 'object' ? (schemaNode as { properties?: Record<string, SchemaField> }).properties ?? {} : {}
    const requiredList = ((schemaNode as { required?: string[] }).required) ?? []

    const attributes: Attribute[] = []
    for (const key of Object.keys(props)) {
      const child = props[key]
      if (child.type === 'object') continue
      if (child.type === 'array' && child.items && child.items.type === 'object') continue
      if (child.type === 'array') {
        attributes.push({ name: key, type: child.items?.type ?? 'array', isArray: true, required: requiredList.includes(key), enumValues: child.items?.enum })
      } else {
        attributes.push({ name: key, type: child.type, required: requiredList.includes(key), enumValues: child.enum })
      }
    }

    const exists = hasAnyValue(schemaNode, dataNode)
    return {
      kind: 'entity',
      id,
      title,
      path: id,
      attributes,
      requiredCount: requiredList.length,
      exists
    }
  }

  const walkObject = (
    title: string,
    schemaNode: SchemaField | JsonSchema,
    path: (string | number)[],
    dataNode: unknown
  ) => {
    const entity = makeEntity(title, schemaNode, path, dataNode)
    nodes.push({ id: entity.id, data: entity })

    const props = (schemaNode as { properties?: Record<string, SchemaField> }).properties ?? {}
    const requiredList = ((schemaNode as { required?: string[] }).required) ?? []
    const record = isRecord(dataNode) ? dataNode : {}

    for (const key of Object.keys(props)) {
      const child = props[key]
      const childTitle = child.title || key
      if (child.type === 'object') {
        const childPath = [...path, key]
        walkObject(childTitle, child, childPath, record[key])
        const card: Cardinality = requiredList.includes(key) ? '1..1' : '0..1'
        const eid = `${joinPath(path)}->${joinPath(childPath)}`
        edges.push({
          id: eid,
          source: joinPath(path),
          target: joinPath(childPath),
          data: { from: joinPath(path), to: joinPath(childPath), label: `${key} (${card})`, cardinality: card, path: joinPath(childPath) }
        })
      } else if (child.type === 'array' && child.items && child.items.type === 'object') {
        // array of objects: create an entity for the item schema under a stable item token
        const itemEntityPath = [...path, key, itemPathToken]
        walkObject(child.items.title || childTitle, child.items, itemEntityPath, Array.isArray(record[key]) ? record[key] : undefined)
        const card: Cardinality = requiredList.includes(key) ? '1..*' : '0..*'
        const from = joinPath(path)
        const to = joinPath(itemEntityPath)
        const eid = `${from}->${to}`
        edges.push({ id: eid, source: from, target: to, data: { from, to, label: `${key} (${card})`, cardinality: card, path: joinPath([...path, key]) } })
      }
    }
  }

  const rootTitle = schema.title || 'Root'
  walkObject(rootTitle, schema, [], data)

  return { nodes, edges }
}
