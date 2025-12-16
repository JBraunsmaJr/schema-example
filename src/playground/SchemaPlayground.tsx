import React, { useCallback } from "react";
import {
  Box,
  Grid,
  Typography,
  Button,
  Alert,
  Stack,
  Select,
  MenuItem,
} from "@mui/material";
import Editor, { type OnMount } from "@monaco-editor/react";
import { DynamicForm } from "../schema/DynamicForm";
import type { JsonSchema } from "../schema/types";
import { getLocation, parseTree, findNodeAtLocation } from "jsonc-parser";

const SHIPPING: JsonSchema = {
  type: "object",
  title: "Shipping",
  properties: {
    method: {
      type: "string",
      title: "Method",
      enum: ["pickup", "delivery"],
      $order: 1,
    },
    pickupCode: { type: "string", title: "Pickup Code" },
  },
  if: {
    type: "object",
    properties: { method: { type: "string", const: "delivery" } } as any,
  } as any,
  then: {
    type: "object",
    required: ["address"],
    properties: {
      address: { type: "string", title: "Delivery Address", $order: 2 },
    },
  } as any,
  else: {
    type: "object",
    required: ["pickupCode"],
  } as any,
};

const VEHICLE: JsonSchema = {
  type: "object",
  title: "Vehicle",
  properties: {
    type: {
      type: "string",
      title: "Vehicle Type",
      oneOf: [
        { const: "car", title: "Car" },
        { const: "bike", title: "Bike" },
      ],
      $order: 1,
    } as any,
    details: {
      type: "object",
      title: "Details",
      $order: 2,
      properties: {},
    },
  },
  if: {
    type: "object",
    properties: { type: { type: "string", const: "car" } } as any,
  } as any,
  then: {
    type: "object",
    properties: {
      details: {
        type: "object",
        title: "Car Details",
        properties: {
          doors: { type: "integer", title: "Doors", $order: 1 },
          fuel: {
            type: "string",
            oneOf: [
              { const: "gas", title: "Gasoline" },
              { const: "ev", title: "Electric" },
            ],
            $order: 2,
          } as any,
        },
        required: ["doors"],
      },
    },
  } as any,
  else: {
    type: "object",
    properties: {
      details: {
        type: "object",
        title: "Bike Details",
        properties: {
          gears: { type: "integer", title: "Gears", $order: 1 },
        },
      },
    },
  } as any,
};

const EXAMPLES: Record<string, JsonSchema> = {
  Shipping: SHIPPING,
  Vehicle: VEHICLE,
};

export default function SchemaPlayground() {
  const [example, setExample] = React.useState<string>("Shipping");
  const [schemaText, setSchemaText] = React.useState<string>(
    JSON.stringify(EXAMPLES[example], null, 2),
  );
  const [schemaObj, setSchemaObj] = React.useState<JsonSchema>(
    EXAMPLES[example],
  );
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const debounceMs = 400;
  const [highlightPath, setHighlightPath] = React.useState<string | null>(null);
  const editorRef = React.useRef<
    import("monaco-editor").editor.IStandaloneCodeEditor | null
  >(null);
  const monacoRef = React.useRef<typeof import("monaco-editor") | null>(null);
  const decorationsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    const styleId = "json-node-highlight-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      /* Stronger inline background for the exact JSON node */
      .monaco-editor .json-node-highlight {
        /* Theme-aware using CSS vars with safe fallbacks */
        --json-node-bg: rgba(255, 215, 0, 0.35);
        --json-node-outline: rgba(255, 215, 0, 0.60);
        background-color: var(--json-node-bg) !important;
        outline: 1px solid var(--json-node-outline) !important;
        border-radius: 3px;
        box-shadow: 0 0 0 2px rgba(0,0,0,0.0);
        position: relative;
        z-index: 10; /* keep above token backgrounds */
        animation: json-node-pulse 900ms ease-out 1;
      }
      /* Light/Dark tweaks based on Monaco root theme classes */
      .vs .json-node-highlight, .vs-light .json-node-highlight {
        --json-node-bg: rgba(255, 200, 0, 0.35);
        --json-node-outline: rgba(180, 120, 0, 0.7);
      }
      .vs-dark .json-node-highlight, .hc-black .json-node-highlight {
        --json-node-bg: rgba(80, 79, 0, 0.28);
        --json-node-outline: rgba(153, 130, 0, 0.5);
      }

      @keyframes json-node-pulse {
        0% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.6); }
        100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.0); }
      }

      /* Optional: subtle left rail marker via glyph margin */
      .monaco-editor .json-node-glyph {
        background-color: rgba(255, 215, 0, 0.9);
        width: 3px;
        height: 100%;
      }
    `;
    document.head.appendChild(style);
  }, []);

  const loadExample = (name: string) => {
    setExample(name);
    const next = EXAMPLES[name];
    const text = JSON.stringify(next, null, 2);
    setSchemaText(text);
    setSchemaObj(next);
    setFormData({});
    setError(null);
  };

  const applySchema = useCallback(() => {
    try {
      const parsed = JSON.parse(schemaText);
      if (
        parsed?.type !== "object" ||
        !parsed?.properties ||
        typeof parsed.properties !== "object"
      ) {
        throw new Error("Root schema must be an object with properties");
      }
      setSchemaObj(parsed as JsonSchema);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [schemaText]);

  React.useEffect(() => {
    const id = setTimeout(applySchema, debounceMs);

    return () => clearTimeout(id);
  }, [schemaText, applySchema]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco as unknown as typeof import("monaco-editor");
    try {
      const modelUri = monaco.Uri.parse("inmemory://model/schema.json");
      const model = editor.getModel();
      if (model && model.uri.toString() !== modelUri.toString()) {
        monaco.editor.setModelLanguage(model, "json");
        model.setEOL(0);
      }

      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        enableSchemaRequest: false,
        allowComments: true,
        trailingCommas: "ignore",
        schemas: [
          {
            uri: "inapp://schemas/playground.json",
            fileMatch: ["inmemory://model/schema.json", "*"],
            schema: {
              $id: "inapp://schemas/playground.json",
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                type: { const: "object" },
                required: {
                  type: "array",
                  items: { type: "string" },
                },
                properties: {
                  type: "object",
                  additionalProperties: { $ref: "#/definitions/SchemaField" },
                },
                if: { $ref: "#/definitions/SchemaField" },
                then: { $ref: "#/definitions/SchemaField" },
                else: { $ref: "#/definitions/SchemaField" },
              },
              required: ["type", "properties"],
              definitions: {
                OneOfConstOption: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    const: {
                      anyOf: [
                        { type: "string" },
                        { type: "number" },
                        { type: "boolean" },
                      ],
                    },
                    title: { type: "string" },
                  },
                  required: ["const"],
                },
                SchemaField: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    type: {
                      enum: [
                        "string",
                        "number",
                        "boolean",
                        "integer",
                        "array",
                        "object",
                      ],
                      description: "Field type",
                    },
                    title: { type: "string" },
                    description: { type: "string" },
                    enum: {
                      type: "array",
                      items: {
                        anyOf: [
                          { type: "string" },
                          { type: "number" },
                          { type: "boolean" },
                        ],
                      },
                    },
                    oneOf: {
                      type: "array",
                      items: { $ref: "#/definitions/OneOfConstOption" },
                      description:
                        "Alternative to enum: list of {const,title} options",
                    },
                    $order: {
                      type: "number",
                      description:
                        "Custom ordering: smaller numbers render before larger ones",
                    },
                    // conditionals supported at field level
                    if: { $ref: "#/definitions/SchemaField" },
                    then: { $ref: "#/definitions/SchemaField" },
                    else: { $ref: "#/definitions/SchemaField" },
                    properties: {
                      type: "object",
                      additionalProperties: {
                        $ref: "#/definitions/SchemaField",
                      },
                    },
                    items: { $ref: "#/definitions/SchemaField" },
                    required: { type: "array", items: { type: "string" } },
                  },
                  required: ["type"],
                },
              },
            },
          },
        ],
      });
    } catch (e) {
      // Swallow any Monaco config errors to avoid breaking the editor
      console.error("Monaco JSON schema configuration error", e);
    }

    const updateHighlightFromCursor = () => {
      const m = editor.getModel();
      if (!m) return;
      const pos = editor.getPosition();
      if (!pos) return;
      const offset = m.getOffsetAt(pos);
      const text = m.getValue();
      try {
        const loc = getLocation(text, offset);
        const segs = loc.path;
        const names: string[] = [];
        for (let i = 0; i < segs.length - 1; i++) {
          if (segs[i] === "properties" && typeof segs[i + 1] === "string") {
            names.push(String(segs[i + 1]));
            i++;
          }
        }
        if (names.length > 0) {
          setHighlightPath(names.join("."));
        } else {
          setHighlightPath(null);
        }
      } catch (_e) {
        // ignore parsing issues
        setHighlightPath(null);
      }
    };

    updateHighlightFromCursor();
    const disp1 = editor.onDidChangeCursorPosition(updateHighlightFromCursor);
    const disp2 = editor.onDidChangeModelContent(updateHighlightFromCursor);

    // Clear the form-driven highlight when editor gains focus
    const disp3 = editor.onDidFocusEditorText(() => {
      setHighlightPath(null);
      // Clear decorations
      if (decorationsRef.current.length > 0) {
        decorationsRef.current = editor.deltaDecorations(
          decorationsRef.current,
          [],
        );
      }
    });
    editor.onDidDispose(() => {
      disp1.dispose();
      disp2.dispose();
      disp3.dispose();
    });
  };

  // When a form section is focused, highlight and reveal it in Monaco
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    // Clear previous decorations
    if (!highlightPath) {
      if (decorationsRef.current.length > 0) {
        decorationsRef.current = editor.deltaDecorations(
          decorationsRef.current,
          [],
        );
      }
      return;
    }

    try {
      const text = model.getValue();
      const root = parseTree(text);
      if (!root) return;
      // Build JSON path like ['properties','user','properties','profile']
      // For array indices in the form path (e.g., projects.0.name) map index -> 'items'
      const segs = highlightPath.split(".").filter(Boolean);
      const jsonPath: (string | number)[] = [];
      for (const s of segs) {
        const idx = Number(s);
        if (!Number.isNaN(idx) && String(idx) === s) {
          // numeric path segment -> array 'items'
          jsonPath.push("items");
        } else {
          jsonPath.push("properties", s);
        }
      }
      const node = findNodeAtLocation(root, jsonPath);
      if (!node) return;
      const start = model.getPositionAt(node.offset);
      const end = model.getPositionAt(node.offset + node.length);

      // Whole-line decoration for context
      const wholeLineRange = new (monacoRef.current as any).Range(
        start.lineNumber,
        1,
        end.lineNumber,
        1,
      );
      // Precise inline decoration over the exact node
      const inlineRange = new (monacoRef.current as any).Range(
        start.lineNumber,
        start.column,
        end.lineNumber,
        end.column,
      );

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
        {
          range: wholeLineRange,
          options: {
            isWholeLine: true,
            overviewRuler: {
              color: "rgba(255, 215, 0, 0.6)",
              position: (monacoRef.current as any).editor.OverviewRulerLane
                .Full,
            },
            minimap: {
              color: "rgba(255, 215, 0, 0.4)",
              position: 1,
            },
            inlineClassNameAffectsLetterSpacing: false,
            classNameAffectsLetterSpacing: false,
            stickiness: (monacoRef.current as any).editor.TrackedRangeStickiness
              .NeverGrowsWhenTypingAtEdges,
            backgroundColor: "rgba(255, 215, 0, 0.10)",
            glyphMarginClassName: "json-node-glyph",
            glyphMarginHoverMessage: { value: "Selected from form" },
          },
        } as any,
        {
          range: inlineRange,
          options: {
            isWholeLine: false,
            inlineClassName: "json-node-highlight",
            inlineClassNameAffectsLetterSpacing: false,
            stickiness: (monacoRef.current as any).editor.TrackedRangeStickiness
              .NeverGrowsWhenTypingAtEdges,
            classNameAffectsLetterSpacing: false,
          },
        } as any,
      ]);
      // Reveal the section in the center without moving the cursor
      editor.revealRangeInCenter(wholeLineRange);
    } catch (_e) {
      // ignore parse errors
    }
  }, [highlightPath]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="h6">Schema Editor</Typography>
        <Select
          size="small"
          value={example}
          onChange={(e) => loadExample(e.target.value as string)}
        >
          {Object.keys(EXAMPLES).map((k) => (
            <MenuItem key={k} value={k}>
              {k}
            </MenuItem>
          ))}
        </Select>
        <Button variant="contained" onClick={applySchema}>
          Apply
        </Button>
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Editor
            height="70vh"
            defaultLanguage="json"
            value={schemaText}
            onChange={(v) => setSchemaText(v ?? "")}
            onMount={handleEditorMount}
            path="inmemory://model/schema.json"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              theme: "vs-dark",
            }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <DynamicForm
            schema={schemaObj}
            initialData={formData}
            onDataChange={setFormData}
            highlightPath={highlightPath}
            onSectionFocus={(p) => setHighlightPath(p)}
            onSubmit={(data) => console.log("submit", data)}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
