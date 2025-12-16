import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { Box, Paper, Typography } from "@mui/material";
import type { JsonSchema } from "./types";
import type { Snippet } from "../snippet/types";

export interface DataJsonEditorProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  schema: JsonSchema;
  snippetLanguage: string; // usually "json"
  title?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export default function DataJsonEditor(props: DataJsonEditorProps) {
  const { value, onChange, schema, snippetLanguage, title } = props;

  const [text, setText] = useState<string>(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const completionRef = useRef<Monaco.IDisposable | null>(null);

  useEffect(
    function syncFromValue() {
      const next = JSON.stringify(value, null, 2);
      if (text !== next) setText(next);
    },
    [value],
  );

  function configureSchema(monaco: typeof Monaco, modelUri: Monaco.Uri) {
    const maybeJsonNs = (
      monaco.languages as unknown as {
        json?: {
          jsonDefaults?: { setDiagnosticsOptions: (o: unknown) => void };
        };
      }
    ).json;
    if (!maybeJsonNs || !maybeJsonNs.jsonDefaults) return;
    const jsonDefaults = maybeJsonNs.jsonDefaults;
    const diagnostics = {
      validate: true,
      allowComments: true,
      enableSchemaRequest: false,
      trailingCommas: "ignore",
      schemas: [
        {
          uri: "inapp://schemas/data.json",
          fileMatch: [modelUri.toString()],
          schema: schema,
        },
      ],
    } as unknown;
    jsonDefaults.setDiagnosticsOptions(diagnostics);
  }

  function loadSnippets(): Snippet[] {
    const raw = localStorage.getItem(`${snippetLanguage}-monaco-snippets`);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Snippet[]) : [];
    } catch (_e) {
      return [];
    }
  }

  function registerSnippets(monaco: typeof Monaco) {
    if (completionRef.current) completionRef.current.dispose();
    const snippets = loadSnippets();
    completionRef.current = monaco.languages.registerCompletionItemProvider(
      snippetLanguage,
      {
        provideCompletionItems(model, position) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          const suggestions: Monaco.languages.CompletionItem[] = snippets.map(
            function mapSnippet(s) {
              return {
                label: s.label,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: s.insertText,
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: s.description,
                detail: `Snippet: ${s.label}`,
                range,
              } as Monaco.languages.CompletionItem;
            },
          );
          return { suggestions };
        },
      },
    );
  }

  const handleMount: OnMount = function onMount(editor, monacoIn) {
    editorRef.current = editor;
    const monaco = monacoIn as unknown as typeof Monaco;
    monacoRef.current = monaco;
    const model = editor.getModel();
    const uri = monaco.Uri.parse("inmemory://model/data.json");
    if (model) {
      if (model.uri.toString() !== uri.toString()) {
        monaco.editor.setModelLanguage(model, "json");
      }
    }
    configureSchema(monaco, uri);
    registerSnippets(monaco);
  };

  function handleChange(val: string | undefined) {
    const nextText = val ?? "";
    setText(nextText);
    try {
      const parsed = JSON.parse(nextText);
      if (!isRecord(parsed)) {
        setError("Root must be a JSON object");
        return;
      }
      setError(null);
      onChange(parsed);
    } catch (e) {
      setError((e as { message?: string }).message ?? String(e));
    }
  }

  // Reconfigure JSON diagnostics when schema prop changes
  useEffect(
    function onSchemaChange() {
      const monaco = monacoRef.current;
      if (!monaco) return;
      const uri = monaco.Uri.parse("inmemory://model/data.json");
      configureSchema(monaco, uri);
    },
    [schema],
  );

  // Re-register snippet completions if language changes or when editor gains focus
  useEffect(
    function onSnippetLangChange() {
      const monaco = monacoRef.current;
      if (!monaco) return;
      registerSnippets(monaco);
      return function cleanup() {
        if (completionRef.current) completionRef.current.dispose();
        completionRef.current = null;
      };
    },
    [snippetLanguage],
  );

  return (
    <Paper sx={{ p: 1, height: 560, display: "flex", flexDirection: "column" }}>
      <Typography variant="h6" sx={{ px: 1, pt: 1, pb: 0.5 }}>
        {title || "JSON Editor"}
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          defaultLanguage="json"
          value={text}
          theme="vs-dark"
          onChange={handleChange}
          onMount={handleMount}
          path="inmemory://model/data.json"
          options={{ fontSize: 13 }}
        />
      </Box>
      {error ? (
        <Typography variant="caption" color="error" sx={{ px: 1, pt: 0.5 }}>
          {error}
        </Typography>
      ) : null}
    </Paper>
  );
}
