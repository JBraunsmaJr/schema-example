import './App.css'
import React, {useEffect, useMemo, useState} from 'react'
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
  ToggleButtonGroup
} from "@mui/material";
import testSchema from "./test-schema.json"
import { DynamicForm } from "./schema/DynamicForm"
import type { JsonSchema, SchemaField } from "./schema/types"
import { SchemaERD } from "./erd/SchemaERD"

function App() {
  type ViewMode = 'form' | 'erd'
  const [view, setView] = useState<ViewMode>('form')
  type Mode = 'light' | 'dark' | 'system'
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('themeMode') as Mode) || 'system')
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => forceUpdateTick(t => t + 1)
    mql.addEventListener?.('change', listener)
    return () => mql.removeEventListener?.('change', listener)
  }, [])
  const [tick, forceUpdateTick] = useState(0) // trigger re-eval on system change
  const resolvedPaletteMode = useMemo<'light' | 'dark'>(() => {
    if (mode === 'system') return prefersDark ? 'dark' : 'light'
    return mode
  }, [mode, prefersDark, tick])
  useEffect(() => {
    localStorage.setItem('themeMode', mode)
  }, [mode])

  const theme = useMemo(() => createTheme({
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
  }), [resolvedPaletteMode])

  // Build a Table of Contents that reflects what currently exists/is filled in the form
  type TocItem = { id: string, title: string, depth: number }

  const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

  const hasAnyValue = (schemaNode: SchemaField | JsonSchema, dataNode: unknown): boolean => {
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
          if (hasAnyValue(props[key], dataNode[key])) return true
        }
        return false
      }
      default:
        return false
    }
  }

  const getTitleForPath = (schemaNode: SchemaField | JsonSchema, path: string[]): string => {
    return (schemaNode as SchemaField).title || (path[path.length - 1] ?? 'Section')
  }

  const buildTocExisting = (
    schemaNode: SchemaField | JsonSchema,
    dataNode: unknown,
    basePath: string[] = [],
    depth = 0,
    skipSelf = false
  ): TocItem[] => {
    const items: TocItem[] = []
    const t = (schemaNode as SchemaField).type ?? 'object'
    const pathStr = basePath.join('.')
    if (!skipSelf && pathStr && (t === 'object' || t === 'array')) {
      items.push({ id: `section-${pathStr}`, title: getTitleForPath(schemaNode, basePath), depth })
    }
    if (t === 'object') {
      const props = (schemaNode as { properties?: Record<string, SchemaField> }).properties
      if (props) {
        const record = isRecord(dataNode) ? dataNode : {}
        for (const key of Object.keys(props)) {
          const childSchema = props[key]
          const childData = record[key]
          items.push(...buildTocExisting(childSchema, childData, [...basePath, key], depth + 1))
        }
      }
    } else if (t === 'array') {
      const itemsSchema = (schemaNode as SchemaField).items
      if (itemsSchema && Array.isArray(dataNode)) {
        if (itemsSchema.type === 'object') {
          dataNode.forEach((it, idx) => {
            if (hasAnyValue(itemsSchema, it)) {
              const itemPath = [...basePath, String(idx)]
              items.push({ id: `section-${itemPath.join('.')}`, title: `Item ${idx + 1}`, depth: depth + 1 })
              items.push(...buildTocExisting(itemsSchema, it, itemPath, depth + 2, true))
            }
          })
        }
      }
    }
    return items
  }

  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const toc = useMemo(() => buildTocExisting(testSchema as JsonSchema, formData, [], 0), [formData])

  // Error list synced from DynamicForm
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleFormSubmit = (data: Record<string, unknown>) => {
    console.log("Form Submitted", data)
    alert(JSON.stringify(data, null, 2))
  }

  const scrollToId = (id: string) => {
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

  const handleErrorClick = (path: string) => scrollToId(`section-${path}`)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', md: view === 'form' ? '280px 1fr 280px' : '1fr' }, gap: 2 }}>
          {/* Left TOC */}
          <Box sx={{ display: { xs: 'none', md: view === 'form' ? 'block' : 'none' } }}>
            <Paper sx={{ position: 'sticky', top: 16, p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Sections</Typography>
              <List dense>
                {toc.map((t) => (
                  <ListItemButton key={t.id} sx={{ pl: 1 + t.depth * 2 }} onClick={() => scrollToId(t.id)}>
                    <ListItemText primaryTypographyProps={{ noWrap: true }} primary={t.title} />
                  </ListItemButton>
                ))}
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
                  onChange={(_, val: ViewMode | null) => { if (val) setView(val) }}
                >
                  <ToggleButton value="form">Form</ToggleButton>
                  <ToggleButton value="erd">ERD</ToggleButton>
                </ToggleButtonGroup>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="theme-mode-label">Theme</InputLabel>
                  <Select labelId="theme-mode-label" label="Theme" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
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
                schema={testSchema}
                onErrorsChange={setErrors}
                onDataChange={setFormData}
              />
            ) : (
              <SchemaERD schema={testSchema as JsonSchema} data={formData} />
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
                  {Object.entries(errors).map(([path, msg]) => (
                    <ListItemButton key={path} onClick={() => handleErrorClick(path)}>
                      <ListItemText primary={msg} secondary={path} />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Paper>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  )
}

export default App
