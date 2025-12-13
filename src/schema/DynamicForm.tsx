import React, { useCallback, useState, type FormEvent, useEffect } from "react"
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
    type SelectChangeEvent, FormControlLabel,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton
} from "@mui/material"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import AddIcon from "@mui/icons-material/Add"
import DeleteIcon from "@mui/icons-material/Delete"
import { type JsonSchema, type SchemaField } from "./types.ts"

interface DynamicFormProps {
    schema: JsonSchema
    initialData?: Record<string, unknown>
    onSubmit: (data: Record<string, unknown>) => void
}

// Move DebouncedTextField to module scope so it is not re-declared per render
// This prevents any chance of hook order issues related to redefining components during parent renders,
// especially when array lengths change under StrictMode double-invocation.
const DebouncedTextField: React.FC<{
    label: string
    type: 'text' | 'number'
    value: string | number
    error?: string
    helperText?: string
    required?: boolean
    onCommit: (next: string | number) => void
}> = React.memo(({ label, type, value, error, helperText, required, onCommit }) => {
    const [local, setLocal] = useState<string | number>(value)

    // keep local in sync when external value changes from elsewhere
    useEffect(() => {
        setLocal(value)
    }, [value])

    useEffect(() => {
        const id = setTimeout(() => {
            if (local !== value) {
                onCommit(local)
            }
        }, 200)
        return () => clearTimeout(id)
    }, [local, value, onCommit])

    return (
        <TextField
            fullWidth
            margin={"normal"}
            label={label}
            type={type}
            value={local}
            onChange={(e) => setLocal(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
            required={required}
            error={!!error}
            helperText={error || helperText}
        />
    )
})

export function DynamicForm({schema, initialData, onSubmit}: DynamicFormProps) {
    const [ formData, setFormData ] = useState<Record<string, unknown>>(initialData ?? {})
    const [ errors, setErrors ] = useState<Record<string, string>>({})

    // Helpers to work with nested paths
    const joinPath = (path: (string | number)[]) => path.map(p => typeof p === 'number' ? String(p) : p).join('.')

    const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
    const getValueAtPath = (obj: unknown, path: (string | number)[]): unknown => {
        let cur: unknown = obj
        for (const key of path) {
            if (cur == null) return undefined
            if (typeof key === 'number') {
                if (Array.isArray(cur)) {
                    cur = cur[key]
                } else {
                    return undefined
                }
            } else {
                if (isRecord(cur)) {
                    cur = cur[key]
                } else {
                    return undefined
                }
            }
        }
        return cur
    }

    const setValueAtPath = (obj: unknown, path: (string | number)[], value: unknown): unknown => {
        if (path.length === 0) return value
        const [head, ...rest] = path
        if (typeof head === 'number') {
            const base = Array.isArray(obj) ? obj.slice() : [] as unknown[]
            const next = setValueAtPath(base[head], rest, value)
            base[head] = next
            return base
        }
        const base = isRecord(obj) ? { ...obj } : {} as Record<string, unknown>
        const next = setValueAtPath(base[head], rest, value)
        base[head] = next
        return base
    }

    const removeValueAtPath = (obj: unknown, path: (string | number)[]): unknown => {
        if (path.length === 0) return obj
        const [head, ...rest] = path
        if (typeof head === 'number') {
            const base = Array.isArray(obj) ? obj.slice() : [] as unknown[]
            if (rest.length === 0) {
                if (head >= 0 && head < base.length) base.splice(head, 1)
                return base
            }
            base[head] = removeValueAtPath(base[head], rest)
            return base
        }
        const base = isRecord(obj) ? { ...obj } : {} as Record<string, unknown>
        if (rest.length === 0) {
            delete base[head]
            return base
        }
        base[head] = removeValueAtPath(base[head], rest)
        return base
    }

    // Stable helpers for updates and error clearing
    const setPathValue = useCallback((path: (string | number)[], value: unknown) => {
        setFormData(prev => setValueAtPath(prev, path, value))
    }, [])

    const clearErrorFor = useCallback((path: (string | number)[]) => {
        const p = joinPath(path)
        setErrors(prev => {
            if (!prev[p]) return prev
            const ne = { ...prev }
            delete ne[p]
            return ne
        })
    }, [])

    const handleSelectChange = useCallback((path: (string | number)[]) => (event: SelectChangeEvent) => {
        setPathValue(path, event.target.value)
        clearErrorFor(path)
    }, [setPathValue, clearErrorFor])

    const handleChange = useCallback((path: (string | number)[], type: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        let value: unknown = event.target.value
        if (type === 'boolean') {
            value = event.target.checked
        } else if (type === 'number' || type === 'integer') {
            value = value === '' ? '' : Number(value)
        }
        setPathValue(path, value)
        clearErrorFor(path)
    }, [setPathValue, clearErrorFor])

    // Stable factory for primitive commit handler (avoid calling hooks inside renderField)
    const handleCommit = useCallback((path: (string | number)[]) => (next: string | number) => {
        setPathValue(path, next)
        clearErrorFor(path)
    }, [setPathValue, clearErrorFor])

    // Simple defaults for new array items
    const defaultForSchema = (field: SchemaField): unknown => {
        if (field.enum && field.enum.length > 0) return field.enum[0]
        switch (field.type) {
            case 'string': return ''
            case 'number':
            case 'integer': return ''
            case 'boolean': return false
            case 'object': return {}
            case 'array': return []
            default: return ''
        }
    }

    // Validation
    const validate = (
        schemaNode: SchemaField | JsonSchema,
        dataNode: unknown,
        basePath: (string | number)[] = [],
        acc: Record<string, string> = {}
    ): Record<string, string> => {
        const nodeType = (schemaNode as SchemaField).type ?? 'object'
        const required = (schemaNode as { required?: string[] }).required
        if (nodeType === 'object' && required && isRecord(dataNode)) {
            required.forEach((k) => {
                const v = dataNode[k]
                if (v === undefined || v === '' || v === null) {
                    acc[joinPath([...basePath, k])] = 'This field is required'
                }
            })
        }
        if (nodeType === 'object') {
            const props = (schemaNode as { properties?: Record<string, SchemaField> }).properties
            if (props && isRecord(dataNode)) {
                Object.entries(props).forEach(([k, child]) =>
                    validate(child, dataNode[k], [...basePath, k], acc)
                )
            }
        } else if (nodeType === 'array' && (schemaNode as SchemaField).items) {
            const items = (schemaNode as SchemaField).items!
            const arr: unknown[] = Array.isArray(dataNode) ? dataNode : []
            arr.forEach((item, idx) => validate(items, item, [...basePath, idx], acc))
        } else {
            // primitives: nothing extra for now
        }
        return acc
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const newErrors: Record<string, string> = validate(schema, formData, [])
        if(Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return
        }

        onSubmit(formData)
    }

    // Debounced input moved to module scope above

    const renderField = (key: string, field: SchemaField, path: (string | number)[]) => {
        const isRequired = ((path.length === 1 ? schema.required : (field.type === 'object' ? field.required : undefined)) ?? []).includes(key)
        const pathStr = joinPath(path)
        const error = errors[pathStr]
        const currentValue = getValueAtPath(formData, path)
        const value = currentValue ?? (field.type === 'array' ? [] : '')

        if(field.enum) {
            return (
                <FormControl fullWidth key={pathStr} error={!!error} margin={"normal"}>
                    <InputLabel id={`label-${pathStr}`}>{field.title || key}</InputLabel>
                    <Select
                        labelId={`label-${pathStr}`}
                        value={value}
                        label={field.title || key}
                        onChange={handleSelectChange(path)}>
                        {field.enum.map((option) => (
                            <MenuItem key={String(option)} value={option}>
                                {String(option)}
                            </MenuItem>
                        ))}
                    </Select>
                    {error && <FormHelperText>{error}</FormHelperText>}
                </FormControl>
            )
        }

        if(field.type === 'object') {
            const properties = field.properties ?? {}
            return (
                <Accordion key={pathStr} defaultExpanded={path.length <= 1} disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ fontWeight: 500 }}>{field.title || key}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={2}>
                            {Object.entries(properties).map(([childKey, childField]) => (
                                <Grid key={joinPath([...path, childKey])} size={{ xs: 12 }}>
                                    {renderField(childKey, childField, [...path, childKey])}
                                </Grid>
                            ))}
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            )
        }

        if(field.type === 'array' && field.items) {
            const arr: unknown[] = Array.isArray(value) ? value : []
            const addItem = () => {
                const newItem = defaultForSchema(field.items!)
                setFormData(prev => setValueAtPath(prev, path, [...arr, newItem]))
            }
            const removeItem = (idx: number) => {
                setFormData(prev => removeValueAtPath(prev, [...path, idx]))
            }
            return (
                <Box key={pathStr} sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle1">{field.title || key} ({arr.length})</Typography>
                        <IconButton color="primary" onClick={addItem} aria-label="add">
                            <AddIcon />
                        </IconButton>
                    </Box>
                    <Box>
                        {arr.map((itemVal, idx) => (
                            <Box key={joinPath([...path, idx])} sx={{ mb: 1 }}>
                                {field.items!.type === 'object' ? (
                                    <Accordion disableGutters defaultExpanded={false}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
                                            <Typography>Item {idx + 1}</Typography>
                                            <Box sx={{ ml: 'auto' }}>
                                                {/**
                                                 * AccordionSummary renders a <button> internally. Nesting a button
                                                 * (IconButton) inside it causes the runtime warning. Render the
                                                 * IconButton as a non-button element while preserving styling.
                                                 */}
                                                <IconButton component="span" color="error" size="small" onClick={(e) => { e.stopPropagation(); removeItem(idx) }} aria-label="remove">
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Grid container spacing={2}>
                                                {Object.entries(field.items!.properties ?? {}).map(([ck, cf]) => (
                                                    <Grid key={joinPath([...path, idx, ck])} size={{ xs: 12 }}>
                                                        {renderField(ck, cf, [...path, idx, ck])}
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </AccordionDetails>
                                    </Accordion>
                                ) : (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {renderField(String(idx), field.items!, [...path, idx])}
                                        <IconButton color="error" onClick={() => removeItem(idx)} aria-label="remove">
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                )}
                            </Box>
                        ))}
                    </Box>
                    {error && <FormHelperText error>{error}</FormHelperText>}
                </Box>
            )
        }

        if(field.type === "boolean") {
            return (
                <FormControl key={pathStr} error={!!error} component={"fieldset"} margin={"normal"}>
                    <FormControlLabel
                        control={
                        <Checkbox checked={!!(currentValue ?? false)}
                                  onChange={handleChange(path, 'boolean')}
                                  color={"primary"}/>
                        }
                        label={field.title || key}
                    />
                    {error && <FormHelperText>{error}</FormHelperText>}
                </FormControl>
            )
        }

        const inputValue: string | number = typeof value === 'number' || typeof value === 'string' ? value : ''

        return (
            <DebouncedTextField
                key={pathStr}
                label={field.title || key}
                type={field.type === "integer" || field.type === "number" ? "number": "text"}
                value={inputValue}
                onCommit={handleCommit(path)}
                required={isRequired}
                error={error}
                helperText={field.description}
            />
        )
    }

    return (
        <Paper sx={{ p: 4, maxWidth: 600, mx: "auto"}}>
            <Typography variant="h5" gutterBottom>
                {schema.title || "Form"}
            </Typography>
            {schema.description && (
                <Typography variant={"body2"} color={"textSecondary"} paragraph>
                    {schema.description}
                </Typography>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <Grid container spacing={2}>
                    {Object.entries(schema.properties).map(([key, field]) => (
                        <Grid key={key} size={{xs: 12}}>
                            {renderField(key, field, [key])}
                        </Grid>
                    ))}
                </Grid>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button type="submit" variant="contained" color="primary">
                        Submit
                    </Button>
                </Box>
            </form>
        </Paper>
    )
}