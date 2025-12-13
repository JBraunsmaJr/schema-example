import './App.css'
import {useEffect, useMemo, useState} from 'react'
import {
  Box,
  Container,
  Typography,
  CssBaseline,
  ThemeProvider,
  createTheme,
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
  type SelectChangeEvent
} from "@mui/material";
import testSchema from "./test-schema.json"
import { DynamicForm } from "./schema/DynamicForm"
import type { JsonSchema, SchemaField } from "./schema/types"
import { SchemaERD } from "./erd/SchemaERD"

function App() {
  type ViewMode = 'form' | 'erd'
  const [view, setView] = useState<ViewMode>('form')
  type Mode = 'light' | 'dark' | 'system'
  function initMode(): Mode { return (localStorage.getItem('themeMode') as Mode) || 'system' }
  const [mode, setMode] = useState<Mode>(initMode)
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  useEffect(function () {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    function incTick(t: number) { return t + 1 }
    function listener() { forceUpdateTick(incTick) }
    mql.addEventListener?.('change', listener)
    return function cleanup() { mql.removeEventListener?.('change', listener) }
  }, [])
  const [tick, forceUpdateTick] = useState(0) // trigger re-eval on system change
  const resolvedPaletteMode = useMemo<'light' | 'dark'>(function () {
    if (mode === 'system') return prefersDark ? 'dark' : 'light'
    return mode
  }, [mode, prefersDark, tick])
  useEffect(function () {
    localStorage.setItem('themeMode', mode)
  }, [mode])

  const theme = useMemo(function () { return createTheme({
    palette: {
      mode: resolvedPaletteMode,
      primary: {
        main: resolvedPaletteMode === 'dark' ? '#8ab4f8' : '#1a73e8'
      },
      secondary: {
        main: resolvedPaletteMode === 'dark' ? '#f2a7c2' : '#ad1457'
      },
      ...(resolvedPaletteMode === 'dark'
        ? {
            background: {
              default: '#0b0f14',
              paper: '#0f1520'
            }
          }
        : {})
    },
    components: {
      MuiPaper: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiAccordion: { styleOverrides: { root: { borderRadius: 12, backgroundImage: 'none' } } },
    }
  }) }, [resolvedPaletteMode])

  // Build a Table of Contents that reflects what currently exists/is filled in the form
  type TocItem = { id: string, title: string, depth: number }

  function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v) }

  function hasAnyValue(schemaNode: SchemaField | JsonSchema, dataNode: unknown): boolean {
    const t = (schemaNode as SchemaField).type ?? 'object'
    switch (t) {
      case 'string':
        return typeof dataNode === 'string' && dataNode.length > 0
      case 'number':
      case 'integer':
        return typeof dataNode === 'number' && !Number.isNaN(dataNode)
      case 'boolean':
        return typeof dataNode === 'boolean'
      case 'array':
        return Array.isArray(dataNode) && dataNode.length > 0
      case 'object': {
        if (!isRecord(dataNode)) return false
        const props = (schemaNode as { properties?: Record<string, SchemaField> }).properties
        if (!props) return Object.keys(dataNode).length > 0
        for (const key of Object.keys(props)) {
          if (hasAnyValue(props[key], (dataNode as Record<string, unknown>)[key])) return true
        }
        return false
      }
      default:
        return false
    }
  }

  function getTitleForPath(schemaNode: SchemaField | JsonSchema, path: string[]): string {
    return (schemaNode as SchemaField).title || (path[path.length - 1] ?? 'Section')
  }

  function buildTocExisting(
    schemaNode: SchemaField | JsonSchema,
    dataNode: unknown,
    basePath: string[] = [],
    depth = 0,
    skipSelf = false
  ): TocItem[] {
    const items: TocItem[] = []
    const t = (schemaNode as SchemaField).type ?? 'object'
    const pathStr = basePath.join('.')
    if (!skipSelf && pathStr && (t === 'object' || t === 'array')) {
      items.push({ id: `section-${pathStr}`, title: getTitleForPath(schemaNode, basePath), depth })
    }
    if (t === 'object') {
      const props = (schemaNode as { properties?: Record<string, SchemaField> }).properties
      if (props) {
        const record = isRecord(dataNode) ? (dataNode as Record<string, unknown>) : {}
        for (const key of Object.keys(props)) {
          const childSchema = props[key]
          const childData = record[key]
          items.push(...buildTocExisting(childSchema, childData, [...basePath, key], depth + 1))
        }
      }
    } else if (t === 'array') {
      const itemsSchema = (schemaNode as SchemaField).items as SchemaField | undefined
      if (itemsSchema && Array.isArray(dataNode)) {
        if (itemsSchema.type === 'object') {
          for (let idx = 0; idx < (dataNode as unknown[]).length; idx++) {
            const it = (dataNode as unknown[])[idx]
            if (hasAnyValue(itemsSchema, it)) {
              const itemPath = [...basePath, String(idx)]
              items.push({ id: `section-${itemPath.join('.')}`, title: `Item ${idx + 1}`, depth: depth + 1 })
              items.push(...buildTocExisting(itemsSchema, it, itemPath, depth + 2, true))
            }
          }
        }
      }
    }
    return items
  }

  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const toc = useMemo(function () { return buildTocExisting(testSchema as JsonSchema, formData, [], 0) }, [formData])

  // Error list synced from DynamicForm
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleFormSubmit(data: Record<string, unknown>) {
    console.log("Form Submitted", data)
    alert(JSON.stringify(data, null, 2))
  }

  function scrollToId(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    // expand parent accordion if collapsed
    const accordion = el.closest('.MuiAccordion-root') as HTMLElement | null
    if (accordion) {
      const summary = accordion.querySelector('.MuiAccordionSummary-root') as HTMLButtonElement | null
      if (summary && summary.getAttribute('aria-expanded') === 'false') {
        summary.click()
      }
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleErrorClick(path: string) { scrollToId(`section-${path}`) }


  // Navigate from ERD to a specific form section/field
  function navigateToPathFromERD(path: string) {
    // switch to form view then scroll after render tick
    setView('form')
    // small timeout to allow layout/accordions to mount
    function delayedScroll() { scrollToId(`section-${path}`) }
    setTimeout(delayedScroll, 0)
  }

  function handleViewChange(_: unknown, val: ViewMode | null) { if (val) setView(val) }
  function handleModeChange(e: SelectChangeEvent) { setMode(e.target.value as Mode) }

  function createTocClick(id: string) {
    function onClick() { scrollToId(id) }
    return onClick
  }

  // No ERD export handle (feature removed)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {view !== 'erd' ? (
        <Container maxWidth="xl">
          <Box sx={{ my: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', md: view === 'form' ? '280px 1fr 280px' : '1fr' }, gap: 2 }}>
          {/* Left TOC */}
          <Box sx={{ display: { xs: 'none', md: view === 'form' ? 'block' : 'none' } }}>
            <Paper sx={{ position: 'sticky', top: 16, p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Sections</Typography>
              <List dense>
                {toc.map(function (t) {
                  return (
                    <ListItemButton key={t.id} sx={{ pl: 1 + t.depth * 2 }} onClick={createTocClick(t.id)}>
                      <ListItemText primaryTypographyProps={{ noWrap: true }} primary={t.title} />
                    </ListItemButton>
                  )
                })}
              </List>
            </Paper>
          </Box>

          {/* Main */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h4" component="h1">Platform Example</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <ToggleButtonGroup
                  size="small"
                  color="primary"
                  exclusive
                  value={view}
                  onChange={handleViewChange}
                >
                  <ToggleButton value="form">Form</ToggleButton>
                  <ToggleButton value="erd">ERD</ToggleButton>
                </ToggleButtonGroup>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="theme-mode-label">Theme</InputLabel>
                  <Select labelId="theme-mode-label" label="Theme" value={mode} onChange={handleModeChange}>
                    <MenuItem value="system">System</MenuItem>
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {view === 'form' ? (
              <DynamicForm
                onSubmit={handleFormSubmit}
                schema={testSchema as JsonSchema}
                onErrorsChange={setErrors}
                onDataChange={setFormData}
              />
            ) : (
              <SchemaERD
                schema={testSchema as JsonSchema}
                data={formData}
                onNavigate={navigateToPathFromERD}
              />
            )}
          </Box>

          {/* Right error panel */}
          <Box sx={{ display: { xs: 'none', md: view === 'form' ? 'block' : 'none' } }}>
            <Paper sx={{ position: 'sticky', top: 16, p: 2 }}>
              <Typography variant="subtitle1">Errors</Typography>
              <Divider sx={{ my: 1 }} />
              {Object.keys(errors).length === 0 ? (
                <Typography variant="body2" color="text.secondary">No errors</Typography>
              ) : (
                <List dense>
                  {Object.entries(errors).map(function ([path, msg]) {
                    function onClick() { handleErrorClick(path) }
                    return (
                      <ListItemButton key={path} onClick={onClick}>
                        <ListItemText primary={msg} secondary={path} />
                      </ListItemButton>
                    )
                  })}
                </List>
              )}
            </Paper>
          </Box>
          </Box>
        </Container>
      ) : (
        <Box sx={{ width: '100%', maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', overflowX: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Entity Relationship Diagram</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ToggleButtonGroup
                size="small"
                color="primary"
                exclusive
                value={view}
                onChange={handleViewChange}
              >
                <ToggleButton value="form">Form</ToggleButton>
                <ToggleButton value="erd">ERD</ToggleButton>
              </ToggleButtonGroup>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="theme-mode-label">Theme</InputLabel>
                <Select labelId="theme-mode-label" label="Theme" value={mode} onChange={handleModeChange}>
                  <MenuItem value="system">System</MenuItem>
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            {/* Ensure the ERD fills the remaining viewport height */}
            <Box sx={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <SchemaERD
                schema={testSchema as JsonSchema}
                data={formData}
                onNavigate={navigateToPathFromERD}
              />
            </Box>
          </Box>
        </Box>
      )}
    </ThemeProvider>
  )
}

export default App
