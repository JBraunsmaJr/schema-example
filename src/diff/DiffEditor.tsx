import {useEffect, useRef} from "react";

import * as monaco from "monaco-editor"
import {Typography} from "@mui/material";

interface DiffEditorProps<T> {
    original: T
    modified: T
    theme?: "light" | "dark" | "system"
}

export default function DiffEditor<T>({original, modified, theme}: DiffEditorProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null)
    const localEditor = useRef<monaco.editor.IDiffEditor | null>(null)

    useEffect(() => {
        if (!containerRef.current) return

        const editor = monaco.editor.createDiffEditor(containerRef.current, {
            enableSplitViewResizing: true,
            renderSideBySide: true,
            automaticLayout: true,
            readOnly: true,
            theme: (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) ? "vs-dark" : "vs"
        })

        localEditor.current = editor

        return () => {
            const model = editor.getModel();
            if (model) {
                model.original.dispose();
                model.modified.dispose();
            }
            editor.dispose()
        }
    }, [])

    useEffect(() => {
        if (!localEditor.current) return
        localEditor.current.updateOptions({
            theme: (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) ? "vs-dark" : "vs"
        })
    }, [theme])

    useEffect(() => {
        if (!localEditor.current) return

        const originalString = typeof original === "object" ? JSON.stringify(original, null, 4) : String(original)
        const modifiedString = typeof modified === "object" ? JSON.stringify(modified, null, 4) : String(modified)

        const originalModel = monaco.editor.createModel(originalString, "json")
        const modifiedModel = monaco.editor.createModel(modifiedString, "json")

        localEditor.current.setModel({
            original: originalModel,
            modified: modifiedModel
        })

    }, [original, modified])

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant={"body2"} color={"primary"}>Diff Viewer</Typography>
            <div ref={containerRef} style={{ flex: 1, minHeight: "500px" }}></div>
        </div>
    )
}