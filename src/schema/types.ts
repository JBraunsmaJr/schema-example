export interface OneOfConstOption {
  const: string | number | boolean;
  title?: string;
}

export interface SchemaField {
  type: "string" | "number" | "boolean" | "integer" | "array" | "object";
  title?: string;
  description?: string;
  enum?: (string | number | boolean)[];
  oneOf?: OneOfConstOption[];
  $order?: number;

  if?: SchemaField;
  then?: SchemaField;
  else?: SchemaField;

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
  if?: SchemaField;
  then?: SchemaField;
  else?: SchemaField;
}
