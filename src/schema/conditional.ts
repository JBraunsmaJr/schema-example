import { type JsonSchema, type SchemaField } from "./types";

// Minimal validator used to evaluate `if` conditions.
// Supports: type, required, properties with nested const/enum checks, and simple primitives.

/**
 * Used to validate 'if' conditions
 * @param schema
 * @param data
 */
export function isValidAgainst(schema: SchemaField, data: unknown): boolean {
  const t = schema.type;
  if (t === "object") {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return false;
    }
    const obj = data as Record<string, unknown>;

    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in obj)) return false;
        const v = obj[key];
        if (v === undefined || v === null || v === "") return false;
      }
    }

    // properties with const/enum (shallow)
    if (schema.properties) {
      for (const [k, childSchema] of Object.entries(schema.properties)) {
        if (obj[k] !== undefined) {
          const v = obj[k];
          if (childSchema.enum) {
            if (!childSchema.enum.some((x) => x === v)) return false;
          }
          if (Object.prototype.hasOwnProperty.call(childSchema as any, "const")) {
            // We don't type `const` in SchemaField; `if` may include it.
            const constVal = (childSchema as any).const;
            if (v !== constVal) return false;
          }

          if (childSchema.type === "object" && typeof v === "object" && v !== null) {
            if (!isValidAgainst(childSchema, v)) return false;
          }
        }
      }
    }
    return true;
  }

  if (t === "array") {
    if (!Array.isArray(data)) return false;
    if (schema.items && data.length > 0) {
      return data.every((item) => isValidAgainst(schema.items as SchemaField, item));
    }
    return true;
  }

  if (t === "string") return typeof data === "string";
  if (t === "number") return typeof data === "number" && Number.isFinite(data as number);
  if (t === "integer") return typeof data === "number" && Number.isInteger(data as number);
  if (t === "boolean") return typeof data === "boolean";

  return true;
}

// Deep merge that overlays `overlay` onto `base`.
// - properties: take base + overlay keys; recursively merge values
// - required: union
// - other simple fields: overlay wins
/**
 * Deep merge which 'overlays' onto 'base'
 * Properties: take base + overlay keys; Recursively merge values
 * Required: union
 * Other simple fields: overlay wins
 * @param base
 * @param overlay
 */
export function mergeSchemas(base: SchemaField, overlay: SchemaField): SchemaField {
  let out: SchemaField = { ...base, ...overlay };

  if (base.required || overlay.required) {
    const set = new Set([...(base.required ?? []), ...(overlay.required ?? [])]);
    out.required = Array.from(set);
  }

  if (base.type === "object" || overlay.type === "object") {
    const baseProps = base.properties ?? {};
    const overProps = overlay.properties ?? {};
    const allKeys = new Set([...Object.keys(baseProps), ...Object.keys(overProps)]);
    const merged: Record<string, SchemaField> = {};
    for (const k of allKeys) {
      const b = baseProps[k];
      const o = overProps[k];
      if (b && o) merged[k] = mergeSchemas(b, o);
      else merged[k] = (o ?? b)!;
    }
    out = { ...out, type: "object", properties: merged };
  }

  if ((base.type === "array" || overlay.type === "array") && (base.items || overlay.items)) {
    const b = base.items ?? overlay.items!;
    const o = overlay.items ?? base.items!;
    out = { ...out, type: "array", items: mergeSchemas(b!, o!) };
  }

  return out;
}

// Compute the effective schema for a node given current data by applying if/then/else
/**
 * Compute effective schema for a node given current data by applying if/then/else
 * @param node
 * @param data
 */
export function resolveEffectiveSchema<T extends JsonSchema | SchemaField>(
  node: T,
  data: unknown,
): T {
  function visit(field: SchemaField, value: unknown): SchemaField {
    let working = field;

    if (field.if && (field.then || field.else)) {
      const matches = isValidAgainst(field.if, value);
      const branch = matches ? field.then : field.else;
      if (branch) {
        working = mergeSchemas(field, branch);
      }
    }

    if (working.type === "object" && working.properties) {
      const nextProps: Record<string, SchemaField> = {};
      const obj = (typeof value === "object" && value !== null && !Array.isArray(value))
        ? (value as Record<string, unknown>)
        : {};
      for (const [k, v] of Object.entries(working.properties)) {
        nextProps[k] = visit(v, obj[k]);
      }
      working = { ...working, properties: nextProps };
    }

    if (working.type === "array" && working.items) {
      const arr = Array.isArray(value) ? value : [];
      working = { ...working, items: visit(working.items, arr[0]) };
    }

    return working;
  }

  if ((node as any).type === "object" && (node as JsonSchema).properties) {
    const schema = node as JsonSchema;
    const obj = (typeof data === "object" && data !== null && !Array.isArray(data))
      ? (data as Record<string, unknown>)
      : {};

    // Apply root-level if/then/else by treating the root as a SchemaField
    let workingRoot: SchemaField = {
      type: "object",
      title: schema.title,
      description: schema.description,
      properties: { ...schema.properties },
      required: schema.required,
      if: (schema as any).if,
      then: (schema as any).then,
      else: (schema as any).else,
    } as SchemaField;

    if ((schema as any).if && ((schema as any).then || (schema as any).else)) {
      const matches = isValidAgainst((schema as any).if as SchemaField, data);
      const branch: SchemaField | undefined = matches
        ? ((schema as any).then as SchemaField | undefined)
        : ((schema as any).else as SchemaField | undefined);
      if (branch) {
        workingRoot = mergeSchemas(workingRoot, branch);
      }
    }

    const nextProps: Record<string, SchemaField> = {};
    for (const [k, v] of Object.entries(workingRoot.properties ?? {})) {
      nextProps[k] = visit(v, obj[k]);
    }
    workingRoot = { ...workingRoot, properties: nextProps };

    const out: JsonSchema = {
      type: "object",
      title: workingRoot.title ?? schema.title,
      description: workingRoot.description ?? schema.description,
      properties: workingRoot.properties ?? {},
      required: workingRoot.required,
    };
    return out as unknown as T;
  }

  return node;
}

/**
 * Remove data for properties that do not exist in the effective schema (branch-only) fields deactivated
 * @param schema
 * @param data
 */
export function pruneDataAgainstSchema(schema: SchemaField | JsonSchema, data: unknown): unknown {
  if ((schema as SchemaField).type === "object" && (schema as any).properties) {
    const props = (schema as any).properties as Record<string, SchemaField>;
    const src = (typeof data === "object" && data !== null && !Array.isArray(data))
      ? (data as Record<string, unknown>)
      : {};
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      const childSchema = props[key];
      out[key] = pruneDataAgainstSchema(childSchema, src[key]);
    }
    return out;
  }
  if ((schema as SchemaField).type === "array" && (schema as SchemaField).items) {
    const itemsSchema = (schema as SchemaField).items!;
    const arr = Array.isArray(data) ? data : [];
    return arr.map((item) => pruneDataAgainstSchema(itemsSchema, item));
  }
  return data;
}
