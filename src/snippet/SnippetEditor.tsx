import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Snippet } from "./types.ts";
import type * as Monaco from "monaco-editor";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

interface SnippetEditorProps {
  snippetLanguage: string;
}

export default function SnippetEditor({ snippetLanguage }: SnippetEditorProps) {
  const [newSnippet, setNewSnippet] = useState<Snippet>({
    id: "",
    label: "",
    insertText: "",
    description: "",
  });
  const [saved, setSaved] = useState<string>('')

  const [jsonDraft, setJsonDraft] = useState<string>("[]");
  const [jsonError, setJsonError] = useState<string | null>(null);

  function validateAndNormalizeSnippet(snippet: Snippet): string[] {
    const errors: string[] = [];
    if (!snippet.label) errors.push("Label is required");
    if (!snippet.insertText) errors.push("Insert text is required");
    if (!snippet.description) errors.push("Description is required");
    return errors;
  }

  function addSnippet(snippet: Snippet) {
    const errors = validateAndNormalizeSnippet(snippet);
    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }
    const withId: Snippet = { ...snippet, id: Date.now().toString() };
    const newSaved = JSON.stringify((storedSnippets || []).concat(withId))
    localStorage.setItem(
      `${snippetLanguage}-monaco-snippets`,
      newSaved
    );
    setSaved(newSaved)
    setNewSnippet({ label: "", insertText: "", description: "", id: "" });
  }

  function removeSnippet(snippet: Snippet) {
    const newSaved = JSON.stringify(storedSnippets?.filter((s) => s.id !== snippet.id) || [])
    localStorage.setItem(
      `${snippetLanguage}-monaco-snippets`,
      newSaved,
    );
    setSaved(newSaved)
  }

  const storedSnippets = useMemo(() => {
    const localSaved = localStorage.getItem(`${snippetLanguage}-monaco-snippets`);
    if (localSaved) {
      try {
        return JSON.parse(localSaved) as Snippet[];
      } catch (_e) {
      }
    }

    return []
  }, [snippetLanguage, saved]);

  useEffect(
    function saveToStorage() {
      localStorage.setItem(
        `${snippetLanguage}-monaco-snippets`,
        JSON.stringify(storedSnippets),
      );
    },
    [storedSnippets, snippetLanguage],
  );

  // Sync JSON draft when storedSnippets changes
  useEffect(
    function syncDraftFromState() {
      setJsonDraft(JSON.stringify(storedSnippets, null, 2));
      setJsonError(null);
    },
    [storedSnippets],
  );

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const providerRef = useRef<Monaco.IDisposable | null>(null);

  function registerSnippets(monaco: typeof Monaco) {
    if (providerRef.current) providerRef.current.dispose();
    providerRef.current = monaco.languages.registerCompletionItemProvider(
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
          const suggestions: Monaco.languages.CompletionItem[] =
            storedSnippets.map(function mapToSuggestion(snippet) {
              return {
                label: snippet.label,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: snippet.insertText,
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: snippet.description,
                detail: `Snippet: ${snippet.label}`,
                range: range,
              } as Monaco.languages.CompletionItem;
            });
          return { suggestions };
        },
      },
    );
  }

  useEffect(
    function syncProvider() {
      if (monacoRef.current && editorRef.current) {
        registerSnippets(monacoRef.current);
      }
    },
    [storedSnippets, snippetLanguage],
  );

  function configureJsonSchema(monaco: typeof Monaco) {
    try {
      const schemaUri = "inmemory://model/snippets.schema.json";
      const snippetSchema = {
        $id: schemaUri,
        type: "array",
        title: "Snippet List",
        items: {
          type: "object",
          required: ["label", "insertText", "description"],
          properties: {
            id: { type: "string", description: "Generated id" },
            label: { type: "string", description: "Completion label" },
            insertText: {
              type: "string",
              description: "Snippet body; supports Monaco snippet syntax",
            },
            description: { type: "string", description: "Details" },
          },
          additionalProperties: false,
        },
      } as const;

      // Access via a narrowed shape to satisfy TS across Monaco versions
      const jsonNs = (
        monaco.languages as unknown as {
          json: {
            jsonDefaults: { setDiagnosticsOptions: (opts: unknown) => void };
          };
        }
      ).json;
      jsonNs.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        enableSchemaRequest: false,
        schemas: [
          {
            uri: schemaUri,
            fileMatch: ["*snippets.json"],
            schema: snippetSchema as unknown,
          },
        ],
      });
    } catch (_e) {
      // swallow configuration errors to avoid breaking editor
    }
  }

  const handleDidMount: OnMount = function onMount(editor, monaco) {
    editorRef.current =
      editor as unknown as Monaco.editor.IStandaloneCodeEditor;
    monacoRef.current = monaco as unknown as typeof Monaco;

    configureJsonSchema(monacoRef.current);
    registerSnippets(monacoRef.current);

    editor.updateOptions({
      wordWrap: "on",
      minimap: { enabled: false },
      suggest: { snippetsPreventQuickSuggestions: false },
      quickSuggestions: { other: true, comments: false, strings: false },
    });
  };

  function handleJsonChange(value: string | undefined) {
    const v = value ?? "";
    setJsonDraft(v);
    try {
      const parsed = JSON.parse(v) as unknown;
      if (Array.isArray(parsed)) {
        // Try to coerce into Snippet[]; generate ids if missing
        const next: Snippet[] = [];
        for (let i = 0; i < parsed.length; i++) {
          const obj = parsed[i] as Record<string, unknown>;
          const candidate: Snippet = {
            id:
              typeof obj.id === "string" && obj.id
                ? (obj.id as string)
                : `${Date.now()}-${i}`,
            label: String(obj.label ?? ""),
            insertText: String(obj.insertText ?? ""),
            description: String(obj.description ?? ""),
          };
          const errs = validateAndNormalizeSnippet(candidate);
          if (errs.length === 0) next.push(candidate);
        }

        localStorage.setItem(`${snippetLanguage}-monaco-snippets`, `${JSON.stringify(next, null, 2)}`)
        setSaved(`${JSON.stringify(next, null, 2)}`)
        setJsonError(null);
      } else {
        setJsonError("Root must be an array of snippets");
      }
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }

  function handleFieldChange(
    key: keyof Omit<Snippet, "id">,
  ): (e: React.ChangeEvent<HTMLInputElement>) => void {
    function handler(e: React.ChangeEvent<HTMLInputElement>) {
      setNewSnippet((prev) => ({ ...prev, [key]: e.target.value }) as Snippet);
    }
    return handler;
  }

  function handleAddClick() {
    addSnippet(newSnippet);
  }

  function renderSnippetRow(snippet: Snippet) {
    return (
      <Paper
        key={snippet.id}
        variant="outlined"
        sx={{ p: 1, display: "flex", alignItems: "center", gap: 2 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {snippet.label}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }} noWrap>
            {snippet.description}
          </Typography>
        </Box>
        <IconButton
          aria-label="delete"
          color="error"
          onClick={function onDeleteClick() {
            removeSnippet(snippet);
          }}
          size="small"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1.6fr" },
          gap: 2,
        }}
      >
        <Box>
          <Paper sx={{ p: 2 }} elevation={2}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Add Snippet ({snippetLanguage})
            </Typography>
            <TextField
              fullWidth
              label="Label"
              value={newSnippet.label}
              onChange={handleFieldChange("label")}
              margin="dense"
            />
            <TextField
              fullWidth
              label="Description"
              value={newSnippet.description}
              onChange={handleFieldChange("description")}
              margin="dense"
            />
            <TextField
              fullWidth
              label="Insert Text"
              value={newSnippet.insertText}
              onChange={handleFieldChange("insertText")}
              margin="dense"
              multiline
              minRows={3}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
              <Button variant="contained" onClick={handleAddClick}>
                Add
              </Button>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Saved Snippets
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {storedSnippets.length === 0 ? (
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  No snippets yet.
                </Typography>
              ) : (
                storedSnippets.map(renderSnippetRow)
              )}
            </Box>
          </Paper>
        </Box>
        <Box>
          <Paper
            sx={{ p: 1, height: 520, display: "flex", flexDirection: "column" }}
            elevation={2}
          >
            <Typography variant="h6" sx={{ px: 1, pt: 1 }}>
              Raw JSON
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                value={jsonDraft}
                theme="vs-dark"
                onChange={handleJsonChange}
                onMount={handleDidMount}
                path="user://snippets.json"
                options={{ fontSize: 13 }}
              />
            </Box>
            {jsonError ? (
              <Typography
                color="error"
                variant="caption"
                sx={{ px: 1, py: 0.5 }}
              >
                {jsonError}
              </Typography>
            ) : null}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
