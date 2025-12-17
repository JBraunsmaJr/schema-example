import { useEffect, useMemo, useRef, useState } from "react";
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
  const [saved, setSaved] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<string>("");
  const [descDraft, setDescDraft] = useState<string>("");
  const [bodyDraft, setBodyDraft] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const saveTimerRef = useRef<number | null>(null);

  function persist(snips: Snippet[]) {
    const json = JSON.stringify(snips);
    localStorage.setItem(`${snippetLanguage}-monaco-snippets`, json);
    setSaved(json);
  }

  function addSnippet() {
    const nowId = `${Date.now()}`;
    const next: Snippet = {
      id: nowId,
      label: "New Snippet",
      description: "",
      insertText: "${1:placeholder}",
    };
    const list = (storedSnippets || []).concat(next);
    persist(list);
    setSelectedId(nowId);
    setLabelDraft(next.label);
    setDescDraft(next.description);
    setBodyDraft(next.insertText);
  }

  function removeSnippet(snippet: Snippet) {
    const list = (storedSnippets || []).filter((s) => s.id !== snippet.id);
    persist(list);
    if (selectedId === snippet.id) {
      const first = list[0];
      setSelectedId(first ? first.id : null);
      setLabelDraft(first ? first.label : "");
      setDescDraft(first ? first.description : "");
      setBodyDraft(first ? first.insertText : "");
    }
  }

  const storedSnippets = useMemo(() => {
    const localSaved = localStorage.getItem(
      `${snippetLanguage}-monaco-snippets`,
    );
    if (localSaved) {
      try {
        return JSON.parse(localSaved) as Snippet[];
      } catch (_e) {}
    }

    return [];
  }, [snippetLanguage, saved]);

  useEffect(
    function initSelectionAndDrafts() {
      const first = storedSnippets[0] ?? null;
      const id = selectedId && storedSnippets.find((s) => s.id === selectedId)
        ? selectedId
        : first?.id ?? null;
      setSelectedId(id);
      if (id) {
        const s = storedSnippets.find((x) => x.id === id)!;
        setLabelDraft(s.label);
        setDescDraft(s.description);
        setBodyDraft(s.insertText);
      } else {
        setLabelDraft("");
        setDescDraft("");
        setBodyDraft("");
      }
    },
    [snippetLanguage, saved],
  );

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const providerRef = useRef<Monaco.IDisposable | null>(null);
  const providerVarsRef = useRef<Monaco.IDisposable | null>(null);
  const tokensProviderRef = useRef<Monaco.IDisposable | null>(null);
  const diagOwnerRef = useRef<string>("snippet-body-owner");
  const registeredLangsRef = useRef<Set<string>>(new Set());

  function registerSnippets(monaco: typeof Monaco) {
    if (providerRef.current) providerRef.current.dispose();
    if (providerVarsRef.current) providerVarsRef.current.dispose();
    if(tokensProviderRef.current) tokensProviderRef.current.dispose();

    monaco.editor.defineTheme("snippet-theme", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "snippet.placeholder", foreground: "ffb86c", fontStyle: "bold"},
        { token: "snippet.variable", foreground: "8be9fd", fontStyle: "italic"}
      ],
      colors: {}
    })

    const langId = `${snippetLanguage}-snippet-body`;

    // Ensure language is registered before setting tokens provider
    if (!registeredLangsRef.current.has(langId)) {
      try {
        monaco.languages.register({ id: langId });
      } catch (_e) {
        // ignore if already registered by another mount
      }
      registeredLangsRef.current.add(langId);
    }

    tokensProviderRef.current = monaco.languages.setMonarchTokensProvider(langId, {
      tokenizer: {
        root:[
            // Snippet placeholders: ${1:default}, $1, ${variable}
            [/\$\{[0-9]+:[^}]*\}/, "snippet.placeholder"],
            [/\$\{[0-9]+\}/, "snippet.placeholder"],
            [/\$[0-9]+/, "snippet.placeholder"],
            [/\$\{[A-Z_][A-Z0-9_]*\}/, "snippet.variable"],
            [/\$\{[a-zA-Z_][a-zA-Z0-9_]*\}/, "snippet.variable"],
            // delimiters for visibility
            [/\$|\{|\}/, "delimiter"]
        ]
      }
    })

    monaco.editor.setTheme("snippet-theme");

    // Ensure the model is using our custom language id
    const model = editorRef.current?.getModel();
    if (model) {
      try {
        monaco.editor.setModelLanguage(model, langId);
      } catch (_e) {}
    }

    // Provide completions for common placeholder constructs and variables
    providerRef.current = monaco.languages.registerCompletionItemProvider(
      langId,
      {
        triggerCharacters: ["$", "{"],
        provideCompletionItems(model, position) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          const variables = [
            "TM_FILENAME",
            "TM_FILENAME_BASE",
            "TM_DIRECTORY",
            "CURRENT_YEAR",
            "CURRENT_MONTH",
            "CURRENT_DATE",
            "CURRENT_HOUR",
            "CURRENT_MINUTE",
            "CURRENT_SECOND",
            "CLIPBOARD",
          ];

          const suggestions: Monaco.languages.CompletionItem[] = [
            {
              label: "$1",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "$1",
              range,
              detail: "Tab stop 1",
            },
            {
              label: "${1:placeholder}",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "${1:placeholder}",
              range,
              detail: "Tab stop with default",
            },
            {
              label: "${2:name}",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "${2:name}",
              range,
              detail: "Named placeholder",
            },
            ...variables.map((v) => ({
              label: `
${`\${${v}}`}`,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: `
${`\${${v}}`}`,
              range,
              detail: `Variable ${v}`,
            })) as unknown as Monaco.languages.CompletionItem[],
          ];
          // Ensure insertTextRules for snippet entries
          suggestions.forEach((s) => {
            (s as any).insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
          });
          return { suggestions };
        },
      },
    );

    // Extra provider to ensure clean variable suggestions without formatting issues
    providerVarsRef.current = monaco.languages.registerCompletionItemProvider(
      langId,
      {
        triggerCharacters: ["$", "{"],
        provideCompletionItems(_model, position) {
          const variables = [
            "TM_FILENAME",
            "TM_FILENAME_BASE",
            "TM_DIRECTORY",
            "CURRENT_YEAR",
            "CURRENT_MONTH",
            "CURRENT_DATE",
            "CURRENT_HOUR",
            "CURRENT_MINUTE",
            "CURRENT_SECOND",
            "CLIPBOARD",
          ];
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column,
            endColumn: position.column,
          };
          const suggestions: Monaco.languages.CompletionItem[] = variables.map((v) => ({
            label: `\${${v}}`,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: `\${${v}}`,
            range,
            detail: `Variable ${v}`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          } as unknown as Monaco.languages.CompletionItem));
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
      return () => {
        if (providerRef.current) providerRef.current.dispose();
        if (providerVarsRef.current) providerVarsRef.current.dispose();
        if (tokensProviderRef.current) tokensProviderRef.current.dispose();
      };
    },
    [snippetLanguage],
  );

  const handleDidMount: OnMount = function onMount(editor, monaco) {
    editorRef.current =
      editor as unknown as Monaco.editor.IStandaloneCodeEditor;
    monacoRef.current = monaco as unknown as typeof Monaco;

    // We only need snippet body language/registrations here
    registerSnippets(monacoRef.current);

    editor.updateOptions({
      wordWrap: "on",
      minimap: { enabled: false },
      suggest: { snippetsPreventQuickSuggestions: false },
      quickSuggestions: { other: true, comments: true, strings: true },
    });
  };

  function validateBodyAndMark() {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;
    const text = bodyDraft;
    const markers: Monaco.editor.IMarkerData[] = [] as any;
    // Simple validation: detect '${' without a closing '}'
    const stack: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '$' && text[i + 1] === '{') {
        stack.push(i);
      }
      if (text[i] === '}') {
        stack.pop();
      }
    }
    if (stack.length > 0) {
      const idx = stack[stack.length - 1];
      const pos = model.getPositionAt(idx);
      markers.push({
        severity: 4, // Warning
        message: "Unclosed placeholder: missing '}'",
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column + 2,
      } as any);
    }
    // Invalid negative indices like $-1
    const negIdx = /\$-\d+/g;
    let m: RegExpExecArray | null;
    while ((m = negIdx.exec(text))) {
      const start = m.index;
      const pos = model.getPositionAt(start);
      markers.push({
        severity: 4,
        message: "Tab stop index must be a non-negative integer",
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column + m[0].length,
      } as any);
    }
    monaco.editor.setModelMarkers(model, diagOwnerRef.current, markers);
  }

  // Debounce save of drafts into selected snippet
  useEffect(
    function debouncedPersist() {
      if (!selectedId) return;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      setIsSaving(true);
      saveTimerRef.current = window.setTimeout(() => {
        const idx = storedSnippets.findIndex((s) => s.id === selectedId);
        if (idx >= 0) {
          const next = storedSnippets.slice();
          next[idx] = {
            ...next[idx],
            label: labelDraft,
            description: descDraft,
            insertText: bodyDraft,
          };
          persist(next);
        }
        setIsSaving(false);
        validateBodyAndMark();
      }, 500);
      return () => {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      };
    },
    [labelDraft, descDraft, bodyDraft, selectedId, snippetLanguage],
  );

  function handleSelect(snippet: Snippet) {
    setSelectedId(snippet.id);
    setLabelDraft(snippet.label);
    setDescDraft(snippet.description);
    setBodyDraft(snippet.insertText);
    // Validate newly loaded content
    setTimeout(validateBodyAndMark, 0);
  }

  function renderSnippetRow(snippet: Snippet) {
    return (
      <Paper
        key={snippet.id}
        variant="outlined"
        onClick={() => handleSelect(snippet)}
        sx={{ p: 1, display: "flex", alignItems: "center", gap: 2, cursor: "pointer", borderColor: selectedId === snippet.id ? 'primary.main' : undefined, bgcolor: selectedId === snippet.id ? 'action.hover' : undefined }}
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
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 2fr" }, gap: 2 }}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }} elevation={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Snippets ({snippetLanguage})</Typography>
            <Button variant="contained" size="small" onClick={addSnippet}>Add</Button>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 520, overflow: 'auto' }}>
            {storedSnippets.length === 0 ? (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>No snippets yet.</Typography>
            ) : (
              storedSnippets.map(renderSnippetRow)
            )}
          </Box>
        </Paper>

        <Paper sx={{ p: 2, height: 520, display: 'flex', flexDirection: 'column', gap: 1 }} elevation={2}>
          <Typography variant="h6">Editor</Typography>
          {selectedId ? (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
                <TextField label="Label" value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} size="small" />
                <TextField label="Description" value={descDraft} onChange={(e) => setDescDraft(e.target.value)} size="small" />
              </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <Editor
                  height="100%"
                  value={bodyDraft}
                  theme="snippet-theme"
                  onChange={(v) => setBodyDraft(v ?? "")}
                  onMount={handleDidMount}
                  language={`${snippetLanguage}-snippet-body`}
                  path={`user://snippet/${selectedId}.${snippetLanguage}.snippet`}
                  options={{ fontSize: 13 }}
                />
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {isSaving ? 'Saving…' : 'Saved'}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 2 }}>Select a snippet to edit, or click Add.</Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
