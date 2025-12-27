import "./App.css";
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Typography,
  CssBaseline,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  type SelectChangeEvent,
  IconButton,
} from "@mui/material";
import testSchema from "./test-schema.json";
import { DynamicForm } from "./schema/DynamicForm";
import type { JsonSchema, SchemaField } from "./schema/types";
import { SchemaERD } from "./erd/SchemaERD";
import { ArtifactsTreeView } from "./artifacts/ArtifactsTreeView";
import { ArtifactsTagsView } from "./artifacts/ArtifactsTagsView";
import SchemaPlayground from "./playground/SchemaPlayground";
import SnippetEditor from "./snippet/SnippetEditor";
import DataJsonEditor from "./schema/DataJsonEditor";
import DiffEditor from "./diff/DiffEditor";
import {
  ThemeConfigProvider,
  ThemeCustomizationModal,
} from "./theming/ThemeModal.tsx";
import { ColorizeRounded } from "@mui/icons-material";

interface TopbarProps {
  view:
    | "form"
    | "json"
    | "erd"
    | "artifacts-tree"
    | "artifacts-tags"
    | "playground"
    | "snippets"
    | "diff";
  mode: "system" | "light" | "dark";
  handleViewChange: (e: unknown, val: TopbarProps["view"] | null) => void;
  handleModeChange: (e: SelectChangeEvent) => void;
  title: string;
  setModalOpen: (open: boolean) => void;
}

function Topbar({
  view,
  handleViewChange,
  mode,
  handleModeChange,
  title,
  setModalOpen,
}: TopbarProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        mb: 2,
      }}
    >
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <ToggleButtonGroup
          size="small"
          color="primary"
          exclusive
          value={view}
          onChange={handleViewChange}
        >
          <ToggleButton value="form">Form</ToggleButton>
          <ToggleButton value="json">JSON</ToggleButton>
          <ToggleButton value="erd">ERD</ToggleButton>
          <ToggleButton value="artifacts-tree">Artifacts Tree</ToggleButton>
          <ToggleButton value="artifacts-tags">Artifacts Tags</ToggleButton>
          <ToggleButton value="playground">Playground</ToggleButton>
          <ToggleButton value="snippets">Snippets</ToggleButton>
          <ToggleButton value="diff">Diff</ToggleButton>
        </ToggleButtonGroup>
        <IconButton onClick={() => setModalOpen(true)} color={"primary"}>
          <ColorizeRounded />
        </IconButton>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="theme-mode-label">Theme</InputLabel>
          <Select
            labelId="theme-mode-label"
            label="Theme"
            value={mode}
            onChange={handleModeChange}
          >
            <MenuItem value="system">System</MenuItem>
            <MenuItem value="light">Light</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}

function App() {
  type ViewMode =
    | "form"
    | "json"
    | "erd"
    | "artifacts-tree"
    | "artifacts-tags"
    | "playground"
    | "snippets"
    | "diff";
  const [view, setView] = useState<ViewMode>("form");
  const [modalOpen, setModalOpen] = useState(false);

  type Mode = "light" | "dark" | "system";
  function initMode(): Mode {
    return (localStorage.getItem("themeMode") as Mode) || "system";
  }
  const [mode, setMode] = useState<Mode>(initMode);
  useEffect(
    function () {
      localStorage.setItem("themeMode", mode);
    },
    [mode],
  );

  // Build a Table of Contents that reflects what currently exists/is filled in the form
  type TocItem = { id: string; title: string; depth: number };

  function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
  }

  function hasAnyValue(
    schemaNode: SchemaField | JsonSchema,
    dataNode: unknown,
  ): boolean {
    const t = (schemaNode as SchemaField).type ?? "object";
    switch (t) {
      case "string":
        return typeof dataNode === "string" && dataNode.length > 0;
      case "number":
      case "integer":
        return typeof dataNode === "number" && !Number.isNaN(dataNode);
      case "boolean":
        return typeof dataNode === "boolean";
      case "array":
        return Array.isArray(dataNode) && dataNode.length > 0;
      case "object": {
        if (!isRecord(dataNode)) return false;
        const props = (
          schemaNode as { properties?: Record<string, SchemaField> }
        ).properties;
        if (!props) return Object.keys(dataNode).length > 0;
        for (const key of Object.keys(props)) {
          if (
            hasAnyValue(props[key], (dataNode as Record<string, unknown>)[key])
          )
            return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  function getTitleForPath(
    schemaNode: SchemaField | JsonSchema,
    path: string[],
  ): string {
    return (
      (schemaNode as SchemaField).title || (path[path.length - 1] ?? "Section")
    );
  }

  function buildTocExisting(
    schemaNode: SchemaField | JsonSchema,
    dataNode: unknown,
    basePath: string[] = [],
    depth = 0,
    skipSelf = false,
  ): TocItem[] {
    const items: TocItem[] = [];
    const t = (schemaNode as SchemaField).type ?? "object";
    const pathStr = basePath.join(".");
    if (!skipSelf && pathStr && (t === "object" || t === "array")) {
      items.push({
        id: `section-${pathStr}`,
        title: getTitleForPath(schemaNode, basePath),
        depth,
      });
    }
    if (t === "object") {
      const props = (schemaNode as { properties?: Record<string, SchemaField> })
        .properties;
      if (props) {
        const record = isRecord(dataNode)
          ? (dataNode as Record<string, unknown>)
          : {};
        for (const key of Object.keys(props)) {
          const childSchema = props[key];
          const childData = record[key];
          items.push(
            ...buildTocExisting(
              childSchema,
              childData,
              [...basePath, key],
              depth + 1,
            ),
          );
        }
      }
    } else if (t === "array") {
      const itemsSchema = (schemaNode as SchemaField).items as
        | SchemaField
        | undefined;
      if (itemsSchema && Array.isArray(dataNode)) {
        if (itemsSchema.type === "object") {
          for (let idx = 0; idx < (dataNode as unknown[]).length; idx++) {
            const it = (dataNode as unknown[])[idx];
            if (hasAnyValue(itemsSchema, it)) {
              const itemPath = [...basePath, String(idx)];
              items.push({
                id: `section-${itemPath.join(".")}`,
                title: `Item ${idx + 1}`,
                depth: depth + 1,
              });
              items.push(
                ...buildTocExisting(itemsSchema, it, itemPath, depth + 2, true),
              );
            }
          }
        }
      }
    }
    return items;
  }

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [highlightPath, setHighlightPath] = useState<string | null>(null);
  const toc = useMemo(
    function () {
      return buildTocExisting(
        testSchema as unknown as JsonSchema,
        formData,
        [],
        0,
      );
    },
    [formData],
  );

  // Error list synced from DynamicForm
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleFormSubmit(data: Record<string, unknown>) {
    console.log("Form Submitted", data);
    alert(JSON.stringify(data, null, 2));
  }

  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    // expand parent accordion if collapsed
    const accordion = el.closest(".MuiAccordion-root") as HTMLElement | null;
    if (accordion) {
      const summary = accordion.querySelector(
        ".MuiAccordionSummary-root",
      ) as HTMLButtonElement | null;
      if (summary && summary.getAttribute("aria-expanded") === "false") {
        summary.click();
      }
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleErrorClick(path: string) {
    scrollToId(`section-${path}`);
  }

  // Navigate from ERD to a specific form section/field
  function navigateToPathFromERD(path: string) {
    // switch to form view then scroll after render tick
    setView("form");
    // small timeout to allow layout/accordions to mount
    function delayedScroll() {
      scrollToId(`section-${path}`);
    }
    setTimeout(delayedScroll, 0);
  }

  function handleViewChange(_: unknown, val: ViewMode | null) {
    if (val) setView(val);
  }
  function handleModeChange(e: SelectChangeEvent) {
    setMode(e.target.value as Mode);
  }

  function createTocClick(id: string) {
    function onClick() {
      scrollToId(id);
      const path = id.startsWith("section-") ? id.slice("section-".length) : id;
      setHighlightPath(path);
      window.setTimeout(() => setHighlightPath(null), 1500);
    }
    return onClick;
  }

  // No ERD export handle (feature removed)

  return (
    <ThemeConfigProvider>
      <ThemeCustomizationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
      <CssBaseline />
      {view === "form" ? (
        <Container maxWidth="xl">
          <Box
            sx={{
              my: 4,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "280px 1fr 280px" },
              gap: 2,
            }}
          >
            {/* Left TOC */}
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <Paper sx={{ position: "sticky", top: 16, p: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Sections
                </Typography>
                <List dense>
                  {toc.map(function (t) {
                    return (
                      <ListItemButton
                        key={t.id}
                        sx={{ pl: 1 + t.depth * 2 }}
                        onClick={createTocClick(t.id)}
                      >
                        <ListItemText
                          primaryTypographyProps={{ noWrap: true }}
                          primary={t.title}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Paper>
            </Box>

            {/* Main */}
            <Box>
              <Topbar
                view={view}
                setModalOpen={setModalOpen}
                mode={mode}
                handleViewChange={handleViewChange}
                handleModeChange={handleModeChange}
                title={"Schema Example"}
              />
              <DynamicForm
                onSubmit={handleFormSubmit}
                schema={testSchema as unknown as JsonSchema}
                onErrorsChange={setErrors}
                onDataChange={setFormData}
                highlightPath={highlightPath}
              />
            </Box>

            {/* Right error panel */}
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <Paper sx={{ position: "sticky", top: 16, p: 2 }}>
                <Typography variant="subtitle1">Errors</Typography>
                <Divider sx={{ my: 1 }} />
                {Object.keys(errors).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No errors
                  </Typography>
                ) : (
                  <List dense>
                    {Object.entries(errors).map(function ([path, msg]) {
                      function onClick() {
                        handleErrorClick(path);
                      }
                      return (
                        <ListItemButton key={path} onClick={onClick}>
                          <ListItemText primary={msg} secondary={path} />
                        </ListItemButton>
                      );
                    })}
                  </List>
                )}
              </Paper>
            </Box>
          </Box>
        </Container>
      ) : view === "json" ? (
        <Container maxWidth="xl">
          <Box sx={{ my: 4 }}>
            <Topbar
              view={view}
              mode={mode}
              setModalOpen={setModalOpen}
              handleViewChange={handleViewChange}
              handleModeChange={handleModeChange}
              title={"JSON Editor"}
            />
            <Paper sx={{ p: 2 }}>
              <DataJsonEditor
                value={formData}
                onChange={setFormData}
                schema={testSchema as unknown as JsonSchema}
                snippetLanguage="json"
                title="Edit Data as JSON"
              />
            </Paper>
          </Box>
        </Container>
      ) : view === "diff" ? (
        <Container maxWidth="xl">
          <Box sx={{ my: 4 }}>
            <Topbar
              view={view}
              mode={mode}
              setModalOpen={setModalOpen}
              handleViewChange={handleViewChange}
              handleModeChange={handleModeChange}
              title={"Diff Editor"}
            />
            <Paper sx={{ p: 2, height: "70vh" }}>
              <DiffEditor
                theme={mode}
                original={{
                  name: "My Application",
                  version: "1.0.0",
                  description: "Original description",
                  settings: {
                    enabled: true,
                    theme: "light",
                  },
                }}
                modified={{
                  name: "My Application",
                  version: "1.1.0",
                  description: "Updated description",
                  settings: {
                    enabled: false,
                    theme: "dark",
                  },
                }}
              />
            </Paper>
          </Box>
        </Container>
      ) : view === "playground" ? (
        <Container maxWidth="xl">
          <Box sx={{ my: 4 }}>
            <Topbar
              view={view}
              mode={mode}
              setModalOpen={setModalOpen}
              handleViewChange={handleViewChange}
              handleModeChange={handleModeChange}
              title={"Schema Playground"}
            />
            <Paper sx={{ p: 2 }}>
              <SchemaPlayground />
            </Paper>
          </Box>
        </Container>
      ) : view === "snippets" ? (
        <Container maxWidth="lg">
          <Box sx={{ my: 4, display: "flex", flexDirection: "column", gap: 2 }}>
            <Topbar
              view={view}
              mode={mode}
              setModalOpen={setModalOpen}
              handleViewChange={handleViewChange}
              handleModeChange={handleModeChange}
              title={"Snippet Editor"}
            />
            <Paper sx={{ p: 2 }}>
              <SnippetEditor snippetLanguage={"json"} />
            </Paper>
          </Box>
        </Container>
      ) : view === "erd" ? (
        <Container maxWidth={"xl"} sx={{ m: 2 }}>
          <Box
            sx={{
              width: "92vw",
              margin: 0,
              maxWidth: "100%",
              height: "96vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              overflowX: "hidden",
            }}
          >
            <Topbar
              view={view}
              mode={mode}
              setModalOpen={setModalOpen}
              handleViewChange={handleViewChange}
              handleModeChange={handleModeChange}
              title={"Entity Relationship Diagram"}
            />
            <Box
              sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}
            >
              {/* Ensure the ERD fills the remaining viewport height */}
              <Box sx={{ height: "100%", width: "100%", overflow: "hidden" }}>
                <SchemaERD
                  schema={testSchema as unknown as JsonSchema}
                  data={formData}
                  onNavigate={navigateToPathFromERD}
                />
              </Box>
            </Box>
          </Box>
        </Container>
      ) : view === "artifacts-tree" ? (
        <Container maxWidth="lg">
          <Box sx={{ my: 4, display: "flex", flexDirection: "column", gap: 2 }}>
            <Topbar
              view={view}
              mode={mode}
              setModalOpen={setModalOpen}
              handleViewChange={handleViewChange}
              handleModeChange={handleModeChange}
              title={"Artifacts"}
            />
            <Paper sx={{ p: 2, minHeight: "70vh" }}>
              <ArtifactsTreeView />
            </Paper>
          </Box>
        </Container>
      ) : (
        <Container maxWidth="lg">
          <Box sx={{ my: 4, display: "flex", flexDirection: "column", gap: 2 }}>
            <Topbar
              view={view}
              mode={mode}
              setModalOpen={setModalOpen}
              handleViewChange={handleViewChange}
              handleModeChange={handleModeChange}
              title={"Artifacts"}
            />
            <Paper sx={{ p: 2, minHeight: "70vh" }}>
              <ArtifactsTagsView />
            </Paper>
          </Box>
        </Container>
      )}
    </ThemeConfigProvider>
  );
}

export default App;
