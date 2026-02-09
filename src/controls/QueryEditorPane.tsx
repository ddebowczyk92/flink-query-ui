import React, { useCallback, useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import Editor, { OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import QueryTabs from './tabs/QueryTabs'
import Queries from '../schema/Queries'
import QueryInfo from '../schema/QueryInfo'

export interface EditorHandle {
    getSelectedText: () => string | undefined
}

interface QueryEditorPaneProps {
    queries: Queries
    currentQuery: QueryInfo
    height: number
    theme: 'light' | 'dark'
    onExecute: (statementOverride?: string) => void
    onCancel: () => void
    onTabClose?: (tabId: string) => void
    editorHandleRef?: React.MutableRefObject<EditorHandle | null>
}

export default function QueryEditorPane({
    queries,
    currentQuery,
    height,
    theme,
    onExecute,
    onCancel,
    onTabClose: externalTabClose,
    editorHandleRef,
}: QueryEditorPaneProps) {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
    const selectedTextRef = useRef<string | undefined>(undefined)
    const onExecuteRef = useRef(onExecute)
    onExecuteRef.current = onExecute
    const onCancelRef = useRef(onCancel)
    onCancelRef.current = onCancel

    const tabs = queries.getTabs()

    const handleEditorMount: OnMount = useCallback(
        (editor) => {
            editorRef.current = editor

            // Track selection changes so the selected text survives focus loss.
            // Only update when the editor has focus — clicking the Play button
            // causes a blur which collapses the selection, and we want to keep
            // the last user-made selection available.
            editor.onDidChangeCursorSelection((e) => {
                if (!editor.hasTextFocus()) return
                const selection = e.selection
                if (selection && !selection.isEmpty()) {
                    selectedTextRef.current = editor.getModel()?.getValueInRange(selection)?.trim() || undefined
                } else {
                    selectedTextRef.current = undefined
                }
            })

            if (editorHandleRef) {
                editorHandleRef.current = {
                    getSelectedText: () => selectedTextRef.current,
                }
            }

            // Ctrl+Enter / Cmd+Enter to execute — if text is selected, execute only the selection
            editor.addAction({
                id: 'execute-query',
                label: 'Execute Query',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                run: () => {
                    onExecuteRef.current(selectedTextRef.current)
                },
            })

            // Escape to cancel a running query
            editor.addAction({
                id: 'cancel-query',
                label: 'Cancel Query',
                keybindings: [monaco.KeyCode.Escape],
                run: () => onCancelRef.current(),
            })
        },
        [editorHandleRef]
    )

    const handleEditorChange = useCallback(
        (value: string | undefined) => {
            if (value !== undefined) {
                queries.updateQuery(currentQuery.id, { query: value }, true)
            }
        },
        [queries, currentQuery.id]
    )

    const handleTabChange = useCallback(
        (tabId: string) => {
            queries.setCurrentQuery(tabId)
        },
        [queries]
    )

    const handleTabAdd = useCallback(() => {
        queries.addTab()
    }, [queries])

    const handleTabClose = useCallback(
        (tabId: string) => {
            if (externalTabClose) {
                externalTabClose(tabId)
            }
            queries.deleteQuery(tabId)
        },
        [queries, externalTabClose]
    )

    const handleTabRename = useCallback(
        (tabId: string, newTitle: string) => {
            queries.updateQuery(tabId, { title: newTitle })
        },
        [queries]
    )

    const tabBarHeight = 36
    const editorHeight = height - tabBarHeight

    return (
        <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
            <QueryTabs
                tabs={tabs}
                currentTabId={currentQuery.id}
                onTabChange={handleTabChange}
                onTabAdd={handleTabAdd}
                onTabClose={handleTabClose}
                onTabRename={handleTabRename}
            />
            <Box sx={{ flex: 1, minHeight: 0 }}>
                <Editor
                    height={editorHeight > 0 ? editorHeight : 100}
                    language="sql"
                    theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                    value={currentQuery.query || ''}
                    options={{
                        automaticLayout: true,
                        selectOnLineNumbers: true,
                        minimap: { enabled: false },
                        formatOnPaste: true,
                        autoIndent: 'full',
                        scrollBeyondLastLine: false,
                        fontSize: 13,
                        lineNumbersMinChars: 3,
                        padding: { top: 8, bottom: 8 },
                    }}
                    onMount={handleEditorMount}
                    onChange={handleEditorChange}
                />
            </Box>
        </Box>
    )
}
