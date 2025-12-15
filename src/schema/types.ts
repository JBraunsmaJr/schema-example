export interface SchemaField {
  type: "string" | "number" | "boolean" | "integer" | "array" | "object";
  title?: string;
  description?: string;
  enum?: string[] | number[];
  properties?: Record<string, SchemaField>;
  items?: SchemaField;
  required?: string[];
}

export interface JsonSchema {
  title?: string;
  description?: string;
  type: "object";
  properties: Record<string, SchemaField>;
  required?: string[];
}
