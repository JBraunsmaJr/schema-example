export type Cardinality = '0..1' | '1..1' | '0..*' | '1..*'

export interface EntityNodeData {
  kind: 'entity'
  id: string
  title: string
  path: string // dot path
  attributes: Attribute[]
  requiredCount: number
  exists: boolean
}

export interface Attribute {
  name: string
  type: 'string' | 'number' | 'boolean' | 'integer' | 'array' | 'object'
  isArray?: boolean
  required?: boolean
  enumValues?: Array<string | number>
}

export interface RelationEdgeData {
  from: string // source node id
  to: string   // target node id
  label: string
  cardinality: Cardinality
  path: string // property path creating the relation
}

export type NodeData = EntityNodeData
export type EdgeData = RelationEdgeData
