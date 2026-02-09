import React, { useState } from 'react'
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Radio,
    TextField,
    Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import ConnectionManager from '../schema/ConnectionManager'

interface ConnectionDialogProps {
    open: boolean
    onClose: () => void
    connectionManager: ConnectionManager
}

export default function ConnectionDialog({ open, onClose, connectionManager }: ConnectionDialogProps) {
    const [name, setName] = useState('')
    const [url, setUrl] = useState('')
    const [showAddForm, setShowAddForm] = useState(false)
    const [, setTick] = useState(0)

    const connections = connectionManager.getConnections()
    const activeId = connectionManager.getActiveConnectionId()

    const forceUpdate = () => setTick((t) => t + 1)

    const handleAdd = () => {
        if (!name.trim()) return
        connectionManager.addConnection(name.trim(), url.trim())
        setName('')
        setUrl('')
        setShowAddForm(false)
        forceUpdate()
    }

    const handleRemove = (id: string) => {
        connectionManager.removeConnection(id)
        forceUpdate()
    }

    const handleSelect = (id: string) => {
        connectionManager.setActiveConnection(id)
        forceUpdate()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAdd()
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Gateway Connections</DialogTitle>
            <DialogContent>
                {connections.length === 0 && !showAddForm && (
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                        No connections configured. Add one to get started.
                    </Typography>
                )}

                <List dense>
                    {connections.map((conn) => (
                        <ListItem
                            key={conn.id}
                            secondaryAction={
                                <IconButton edge="end" onClick={() => handleRemove(conn.id)} size="small">
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            }
                            disablePadding
                        >
                            <ListItemButton onClick={() => handleSelect(conn.id)} dense>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <Radio edge="start" checked={activeId === conn.id} tabIndex={-1} size="small" />
                                </ListItemIcon>
                                <ListItemText primary={conn.name} secondary={conn.url || '(proxy)'} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>

                {showAddForm && (
                    <>
                        <TextField
                            autoFocus
                            label="Connection Name"
                            fullWidth
                            size="small"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            sx={{ mt: 2, mb: 1 }}
                        />
                        <TextField
                            label="Gateway URL"
                            fullWidth
                            size="small"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Leave empty for same-origin (proxy)"
                            sx={{ mb: 1 }}
                        />
                    </>
                )}
            </DialogContent>
            <DialogActions>
                {showAddForm ? (
                    <>
                        <Button onClick={() => setShowAddForm(false)}>Cancel</Button>
                        <Button onClick={handleAdd} variant="contained" disabled={!name.trim()}>
                            Add
                        </Button>
                    </>
                ) : (
                    <>
                        <Button startIcon={<AddIcon />} onClick={() => setShowAddForm(true)}>
                            Add Connection
                        </Button>
                        <Button onClick={onClose}>Close</Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    )
}
