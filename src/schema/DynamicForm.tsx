import React, { useCallback, useState, type FormEvent, useEffect } from "react";
import {
  TextField,
  Checkbox,
  MenuItem,
  Button,
  Box,
  Typography,
  Paper,
  Grid,
  FormHelperText,
  FormControl,
  InputLabel,
  Select,
  type SelectChangeEvent,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { type JsonSchema, type SchemaField } from "./types.ts";
import { normalizeSchema, sortEntriesByOrder } from "./normalize";
import { pruneDataAgainstSchema, resolveEffectiveSchema } from "./conditional";

interface DynamicFormProps {
  schema: JsonSchema;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onErrorsChange?: (errors: Record<string, string>) => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  /**
   * Highlight a specific section by its dot-path
   * e.g. "details.fuel"
   */
  highlightPath?: string | null;
}

const DebouncedTextField: React.FC<{
  label: string;
  type: "text" | "number";
  value: string | number;
  error?: string;
  helperText?: string;
  required?: boolean;
  onCommit: (next: string | number) => void;
}> = React.memo(
  ({ label, type, value, error, helperText, required, onCommit }) => {
    const [local, setLocal] = useState<string | number>(value);

    useEffect(() => {
      setLocal(value);
    }, [value]);

    useEffect(() => {
      const id = setTimeout(() => {
        if (local !== value) {
          onCommit(local);
        }
      }, 200);
      return () => clearTimeout(id);
    }, [local, value, onCommit]);

    return (
      <TextField
        fullWidth
        margin={"normal"}
        label={label}
        type={type}
        value={local}
        onChange={(e) =>
          setLocal(
            type === "number"
              ? e.target.value === ""
                ? ""
                : Number(e.target.value)
              : e.target.value,
          )
        }
        required={required}
        error={!!error}
        helperText={error || helperText}
      />
    );
  },
);

export function DynamicForm({
  schema,
  initialData,
  onSubmit,
  onErrorsChange,
  onDataChange,
  highlightPath,
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(
    initialData ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const normalizedSchema = React.useMemo(
    () => normalizeSchema(schema),
    [schema],
  );

  const [debouncedData, setDebouncedData] =
    useState<Record<string, unknown>>(formData);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedData(formData), 200);
    return () => clearTimeout(id);
  }, [formData]);

  const effectiveSchema = React.useMemo(
    () => resolveEffectiveSchema<JsonSchema>(normalizedSchema, debouncedData),
    [normalizedSchema, debouncedData],
  );

  useEffect(() => {
    const pruned = pruneDataAgainstSchema(effectiveSchema, formData) as Record<
      string,
      unknown
    >;
    if (JSON.stringify(pruned) !== JSON.stringify(formData)) {
      setFormData(pruned);
    }
  }, [effectiveSchema]);

  const joinPath = (path: (string | number)[]) =>
    path.map((p) => (typeof p === "number" ? String(p) : p)).join(".");

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const getValueAtPath = (obj: unknown, path: (string | number)[]): unknown => {
    let cur: unknown = obj;
    for (const key of path) {
      if (cur == null) return undefined;
      if (typeof key === "number") {
        if (Array.isArray(cur)) {
          cur = cur[key];
        } else {
          return undefined;
        }
      } else {
        if (isRecord(cur)) {
          cur = cur[key];
        } else {
          return undefined;
        }
      }
    }
    return cur;
  };

  const setValueAtPath = (
    obj: unknown,
    path: (string | number)[],
    value: unknown,
  ): unknown => {
    if (path.length === 0) return value;
    const [head, ...rest] = path;
    if (typeof head === "number") {
      const base = Array.isArray(obj) ? obj.slice() : ([] as unknown[]);
      const next = setValueAtPath(base[head], rest, value);
      base[head] = next;
      return base;
    }
    const base = isRecord(obj) ? { ...obj } : ({} as Record<string, unknown>);
    const next = setValueAtPath(base[head], rest, value);
    base[head] = next;
    return base;
  };

  const removeValueAtPath = (
    obj: unknown,
    path: (string | number)[],
  ): unknown => {
    if (path.length === 0) return obj;
    const [head, ...rest] = path;
    if (typeof head === "number") {
      const base = Array.isArray(obj) ? obj.slice() : ([] as unknown[]);
      if (rest.length === 0) {
        if (head >= 0 && head < base.length) base.splice(head, 1);
        return base;
      }
      base[head] = removeValueAtPath(base[head], rest);
      return base;
    }
    const base = isRecord(obj) ? { ...obj } : ({} as Record<string, unknown>);
    if (rest.length === 0) {
      delete base[head];
      return base;
    }
    base[head] = removeValueAtPath(base[head], rest);
    return base;
  };

  const setPathValue = useCallback(
    (path: (string | number)[], value: unknown) => {
      setFormData(
        (prev) => setValueAtPath(prev, path, value) as Record<string, unknown>,
      );
    },
    [],
  );

  const clearErrorFor = useCallback(
    (path: (string | number)[]) => {
      const p = joinPath(path);
      setErrors((prev) => {
        if (!prev[p]) return prev;
        const ne = { ...prev };
        delete ne[p];
        if (onErrorsChange) onErrorsChange(ne);
        return ne;
      });
    },
    [onErrorsChange],
  );

  const handleSelectChange = useCallback(
    (path: (string | number)[]) =>
      (event: SelectChangeEvent, _child?: unknown) => {
        setPathValue(path, event.target.value);
        clearErrorFor(path);
      },
    [setPathValue, clearErrorFor],
  );

  const handleChange = useCallback(
    (path: (string | number)[], type: string) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        let value: unknown = event.target.value;
        if (type === "boolean") {
          value = event.target.checked;
        } else if (type === "number" || type === "integer") {
          value = value === "" ? "" : Number(value);
        }
        setPathValue(path, value);
        clearErrorFor(path);
      },
    [setPathValue, clearErrorFor],
  );

  const handleCommit = useCallback(
    (path: (string | number)[]) => (next: string | number) => {
      setPathValue(path, next);
      clearErrorFor(path);
    },
    [setPathValue, clearErrorFor],
  );

  // Simple defaults for new array items
  const defaultForSchema = (field: SchemaField): unknown => {
    if (field.enum && field.enum.length > 0) return field.enum[0];
    switch (field.type) {
      case "string":
        return "";
      case "number":
      case "integer":
        return "";
      case "boolean":
        return false;
      case "object":
        return {};
      case "array":
        return [];
      default:
        return "";
    }
  };

  const validate = (
    schemaNode: SchemaField | JsonSchema,
    dataNode: unknown,
    basePath: (string | number)[] = [],
    acc: Record<string, string> = {},
  ): Record<string, string> => {
    const nodeType = (schemaNode as SchemaField).type ?? "object";
    const required = (schemaNode as { required?: string[] }).required;
    if (nodeType === "object") {
      const props = (schemaNode as { properties?: Record<string, SchemaField> })
        .properties;
      // Required keys (including arrays that must be non-empty)
      if (required && isRecord(dataNode)) {
        required.forEach((k) => {
          const v = dataNode[k];
          const childSchema = props?.[k];
          const isMissing = v === undefined || v === "" || v === null;
          const isEmptyArrayRequired =
            Array.isArray(v) && childSchema?.type === "array" && v.length === 0;
          if (isMissing || isEmptyArrayRequired) {
            acc[joinPath([...basePath, k])] = "This field is required";
          }
        });
      }
      if (props && isRecord(dataNode)) {
        Object.entries(props).forEach(([k, child]) =>
          validate(child, dataNode[k], [...basePath, k], acc),
        );
      }
    } else if (nodeType === "array" && (schemaNode as SchemaField).items) {
      const items = (schemaNode as SchemaField).items!;
      const arr: unknown[] = Array.isArray(dataNode) ? dataNode : [];
      arr.forEach((item, idx) =>
        validate(items, item, [...basePath, idx], acc),
      );
    } else {
      // primitives: enum membership check when provided
      const f = schemaNode as SchemaField;
      if (f.enum && dataNode !== undefined && dataNode !== "") {
        const ok = (f.enum as unknown[]).some((x) => x === dataNode);
        if (!ok) acc[joinPath(basePath)] = "Invalid value";
      }
    }
    return acc;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = validate(
      effectiveSchema,
      formData,
      [],
    );
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (onErrorsChange) onErrorsChange(newErrors);
      return;
    }
    // Clear errors on success and notify parent
    if (Object.keys(errors).length > 0) {
      setErrors({});
      if (onErrorsChange) onErrorsChange({});
    }
    onSubmit(formData);
  };

  // Notify parent when data changes so TOC can reflect existing/filled sections
  useEffect(() => {
    if (onDataChange) onDataChange(formData);
  }, [formData, onDataChange]);

  const renderField = (
    key: string,
    field: SchemaField,
    path: (string | number)[],
  ) => {
    const isRequired = (
      (path.length === 1
        ? effectiveSchema.required
        : field.type === "object"
          ? field.required
          : undefined) ?? []
    ).includes(key);
    const pathStr = joinPath(path);
    const error = errors[pathStr];
    const isHighlighted = highlightPath === pathStr;
    const currentValue = getValueAtPath(formData, path);
    const value = currentValue ?? (field.type === "array" ? [] : "");

    if (field.enum) {
      // Prefer labels from oneOf if provided
      const labelsByValue: Record<string, string> | undefined = Array.isArray(
        field.oneOf,
      )
        ? Object.fromEntries(
            field.oneOf.map((o) => [
              String(o.const),
              o.title ?? String(o.const),
            ]),
          )
        : undefined;
      return (
        <Box
          id={`section-${pathStr}`}
          sx={{
            border: isHighlighted ? 2 : 0,
            borderColor: isHighlighted ? "secondary.main" : "transparent",
            borderRadius: 1,
            transition: "border-color 150ms ease, border-width 150ms ease",
            px: isHighlighted ? 1 : 0,
            pt: isHighlighted ? 1 : 0,
          }}
        >
          <FormControl
            fullWidth
            key={pathStr}
            error={!!error}
            margin={"normal"}
          >
            <InputLabel id={`label-${pathStr}`}>
              {field.title || key}
            </InputLabel>
            <Select
              labelId={`label-${pathStr}`}
              value={value}
              label={field.title || key}
              onChange={handleSelectChange(path)}
            >
              {field.enum.map((option) => {
                const label = labelsByValue?.[String(option)] ?? String(option);
                return (
                  <MenuItem key={String(option)} value={option}>
                    {label}
                  </MenuItem>
                );
              })}
            </Select>
            {error && <FormHelperText>{error}</FormHelperText>}
          </FormControl>
        </Box>
      );
    }

    if (field.type === "object") {
      const properties = field.properties ?? {};
      return (
        <Accordion
          id={`section-${pathStr}`}
          key={pathStr}
          defaultExpanded={path.length <= 1}
          disableGutters
          sx={{
            border: isHighlighted ? 2 : 1,
            borderColor: isHighlighted ? "secondary.main" : "divider",
            borderRadius: 2,
            transition: "border-color 150ms ease, border-width 150ms ease",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 500 }}>
              {field.title || key}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {sortEntriesByOrder(Object.entries(properties)).map(
                ([childKey, childField]) => (
                  <Grid key={joinPath([...path, childKey])} size={{ xs: 12 }}>
                    {renderField(childKey, childField, [...path, childKey])}
                  </Grid>
                ),
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      );
    }

    if (field.type === "array" && field.items) {
      const arr: unknown[] = Array.isArray(value) ? value : [];
      const addItem = () => {
        const newItem = defaultForSchema(field.items!);
        setFormData(
          (prev) =>
            setValueAtPath(prev, path, [...arr, newItem]) as Record<
              string,
              unknown
            >,
        );
        clearErrorFor(path);
      };
      // Prune and reindex errors when removing an array item so the Errors TOC stays in sync
      const pruneErrorsOnArrayRemoval = (
        arrayPath: (string | number)[],
        removedIdx: number,
      ) => {
        const arrayPathStr = joinPath(arrayPath);
        setErrors((prev) => {
          if (!prev || Object.keys(prev).length === 0) return prev;
          const next: Record<string, string> = {};
          const prefix = arrayPathStr + ".";
          for (const [k, v] of Object.entries(prev)) {
            if (k.startsWith(prefix)) {
              const rest = k.slice(prefix.length);
              const firstSegEnd = rest.indexOf(".");
              const firstSeg =
                firstSegEnd === -1 ? rest : rest.slice(0, firstSegEnd);
              const idxNum = Number(firstSeg);
              if (!Number.isNaN(idxNum)) {
                if (idxNum === removedIdx) {
                  // drop errors that belong to the removed item
                  continue;
                }
                if (idxNum > removedIdx) {
                  // shift following items down by 1
                  const newIdx = String(idxNum - 1);
                  const suffix =
                    firstSegEnd === -1 ? "" : rest.slice(firstSegEnd);
                  const newKey = prefix + newIdx + suffix;
                  next[newKey] = v;
                  continue;
                }
              }
            }
            // keep unrelated keys as-is
            next[k] = v;
          }
          if (onErrorsChange) onErrorsChange(next);
          return next;
        });
      };
      const removeItem = (idx: number) => {
        setFormData(
          (prev) =>
            removeValueAtPath(prev, [...path, idx]) as Record<string, unknown>,
        );
        pruneErrorsOnArrayRemoval(path, idx);
      };
      return (
        <Box
          id={`section-${pathStr}`}
          key={pathStr}
          sx={{
            mt: 2,
            border: isHighlighted ? 2 : 0,
            borderColor: isHighlighted ? "secondary.main" : "transparent",
            borderRadius: 1,
            transition: "border-color 150ms ease, border-width 150ms ease",
            px: isHighlighted ? 1 : 0,
            pt: isHighlighted ? 1 : 0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="subtitle1">
              {field.title || key} ({arr.length})
            </Typography>
            <IconButton color="primary" onClick={addItem} aria-label="add">
              <AddIcon />
            </IconButton>
          </Box>
          <Box>
            {arr.map((_itemVal, idx) => (
              <Box key={joinPath([...path, idx])} sx={{ mb: 1 }}>
                {field.items!.type === "object" ? (
                  <Accordion
                    id={`section-${joinPath([...path, idx])}`}
                    disableGutters
                    defaultExpanded={false}
                    sx={{
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Item {idx + 1}</Typography>
                      <Box sx={{ ml: "auto" }}>
                        <IconButton
                          component="span"
                          color="error"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(idx);
                          }}
                          aria-label="remove"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        {Object.entries(field.items!.properties ?? {}).map(
                          ([ck, cf]) => (
                            <Grid
                              key={joinPath([...path, idx, ck])}
                              size={{ xs: 12 }}
                            >
                              {renderField(ck, cf, [...path, idx, ck])}
                            </Grid>
                          ),
                        )}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {renderField(String(idx), field.items!, [...path, idx])}
                    <IconButton
                      color="error"
                      onClick={() => removeItem(idx)}
                      aria-label="remove"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
          {error && <FormHelperText error>{error}</FormHelperText>}
        </Box>
      );
    }

    if (field.type === "boolean") {
      return (
        <Box id={`section-${pathStr}`}>
          <FormControl
            key={pathStr}
            error={!!error}
            component={"fieldset"}
            margin={"normal"}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!(currentValue ?? false)}
                  onChange={handleChange(path, "boolean")}
                  color={"primary"}
                />
              }
              label={field.title || key}
            />
            {error && <FormHelperText>{error}</FormHelperText>}
          </FormControl>
        </Box>
      );
    }

    const inputValue: string | number =
      typeof value === "number" || typeof value === "string" ? value : "";

    return (
      <Box
        id={`section-${pathStr}`}
        sx={{
          border: isHighlighted ? 2 : 0,
          borderColor: isHighlighted ? "secondary.main" : "transparent",
          borderRadius: 1,
          transition: "border-color 150ms ease, border-width 150ms ease",
          px: isHighlighted ? 1 : 0,
          pt: isHighlighted ? 1 : 0,
        }}
      >
        <DebouncedTextField
          key={pathStr}
          label={field.title || key}
          type={
            field.type === "integer" || field.type === "number"
              ? "number"
              : "text"
          }
          value={inputValue}
          onCommit={handleCommit(path)}
          required={isRequired}
          error={error}
          helperText={field.description}
        />
      </Box>
    );
  };

  return (
    <Paper sx={{ p: 4, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        {effectiveSchema.title || schema.title || "Form"}
      </Typography>
      {(effectiveSchema.description || schema.description) && (
        <Typography variant={"body2"} color={"textSecondary"} paragraph>
          {effectiveSchema.description || schema.description}
        </Typography>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Grid container spacing={2}>
          {sortEntriesByOrder(Object.entries(effectiveSchema.properties)).map(
            ([key, field]) => (
              <Grid key={key} size={{ xs: 12 }}>
                {renderField(key, field, [key])}
              </Grid>
            ),
          )}
        </Grid>

        <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" color="primary">
            Submit
          </Button>
        </Box>
      </form>
    </Paper>
  );
}
