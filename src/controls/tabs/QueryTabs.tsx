import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, IconButton, InputBase, Tab, Tabs as MuiTabs } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import QueryInfo from '../../schema/QueryInfo'

interface QueryTabsProps {
    tabs: QueryInfo[]
    currentTabId: string
    onTabChange: (tabId: string) => void
    onTabAdd: () => void
    onTabClose: (tabId: string) => void
    onTabRename?: (tabId: string, newTitle: string) => void
}

function EditableTabLabel({
    tab,
    isEditing,
    onStartEdit,
    onFinishEdit,
    showClose,
    onClose,
}: {
    tab: QueryInfo
    isEditing: boolean
    onStartEdit: () => void
    onFinishEdit: (newTitle: string) => void
    showClose: boolean
    onClose: () => void
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [editValue, setEditValue] = useState(tab.title)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            setEditValue(tab.title)
            // Defer focus so the input is rendered first
            requestAnimationFrame(() => {
                inputRef.current?.focus()
                inputRef.current?.select()
            })
        }
    }, [isEditing, tab.title])

    const commit = useCallback(() => {
        const trimmed = editValue.trim()
        onFinishEdit(trimmed || tab.title)
    }, [editValue, tab.title, onFinishEdit])

    if (isEditing) {
        return (
            <InputBase
                inputRef={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault()
                        commit()
                    } else if (e.key === 'Escape') {
                        e.preventDefault()
                        onFinishEdit(tab.title) // cancel — keep original
                    }
                    e.stopPropagation()
                }}
                onClick={(e) => e.stopPropagation()}
                sx={{
                    fontSize: '0.8rem',
                    p: 0,
                    '& input': {
                        p: '0 2px',
                        minWidth: 40,
                        maxWidth: 140,
                    },
                }}
            />
        )
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span
                onDoubleClick={(e) => {
                    e.stopPropagation()
                    onStartEdit()
                }}
            >
                {tab.title}
            </span>
            {showClose && (
                <CloseIcon
                    sx={{ fontSize: 14, opacity: 0.6, '&:hover': { opacity: 1 } }}
                    onClick={(e) => {
                        e.stopPropagation()
                        onClose()
                    }}
                />
            )}
        </Box>
    )
}

export default function QueryTabs({
    tabs,
    currentTabId,
    onTabChange,
    onTabAdd,
    onTabClose,
    onTabRename,
}: QueryTabsProps) {
    const [editingTabId, setEditingTabId] = useState<string | null>(null)

    const handleFinishEdit = useCallback(
        (tabId: string, newTitle: string) => {
            setEditingTabId(null)
            if (onTabRename) {
                onTabRename(tabId, newTitle)
            }
        },
        [onTabRename]
    )

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <MuiTabs
                value={currentTabId}
                onChange={(_, value) => onTabChange(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ flex: 1, minHeight: 36 }}
            >
                {tabs.map((tab) => (
                    <Tab
                        key={tab.id}
                        value={tab.id}
                        label={
                            <EditableTabLabel
                                tab={tab}
                                isEditing={editingTabId === tab.id}
                                onStartEdit={() => setEditingTabId(tab.id)}
                                onFinishEdit={(newTitle) => handleFinishEdit(tab.id, newTitle)}
                                showClose={tabs.length > 1}
                                onClose={() => onTabClose(tab.id)}
                            />
                        }
                        sx={{
                            minHeight: 36,
                            py: 0.5,
                            px: 1.5,
                            textTransform: 'none',
                            fontSize: '0.8rem',
                        }}
                    />
                ))}
            </MuiTabs>
            <IconButton size="small" onClick={onTabAdd} sx={{ mx: 0.5 }}>
                <AddIcon fontSize="small" />
            </IconButton>
        </Box>
    )
}
