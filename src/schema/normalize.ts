import { type JsonSchema, type SchemaField } from "./types";

/**
 * Derive enum from oneOf and recurse into objects/keys
 * @param node
 */
export function normalizeSchema<T extends JsonSchema | SchemaField>(
  node: T,
): T {
  function visit(field: SchemaField): SchemaField {
    let out = field;

    if (!out.enum && Array.isArray(out.oneOf) && out.oneOf.length > 0) {
      const enums = out.oneOf
        .filter((o) => Object.prototype.hasOwnProperty.call(o, "const"))
        .map((o) => o.const);
      if (enums.length > 0) {
        out = { ...out, enum: enums };
      }
    }

    if (out.type === "object" && out.properties) {
      const nextProps: Record<string, SchemaField> = {};
      for (const [k, v] of Object.entries(out.properties)) {
        nextProps[k] = visit(v);
      }
      out = { ...out, properties: nextProps };
    }

    if (out.type === "array" && out.items) {
      out = { ...out, items: visit(out.items) };
    }

    return out;
  }

  if ((node as any).type === "object" && (node as JsonSchema).properties) {
    const schema = node as JsonSchema;
    const properties: Record<string, SchemaField> = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      properties[k] = visit(v);
    }
    return { ...(node as object), properties } as T;
  }

  return node;
}

/**
 * Sort object property entries respecting $order
 * @param entries
 */
export function sortEntriesByOrder(
  entries: [string, SchemaField][],
): [string, SchemaField][] {
  return entries.sort(([ak, a], [bk, b]) => {
    const ao = (a as SchemaField).$order;
    const bo = (b as SchemaField).$order;
    const aHas = typeof ao === "number";
    const bHas = typeof bo === "number";
    if (aHas && bHas) return (ao as number) - (bo as number);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return 0;
  });
}
