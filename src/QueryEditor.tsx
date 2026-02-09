import React, { useEffect, useMemo, useState } from 'react'
import { Box, Drawer } from '@mui/material'
import ConnectionManager from './schema/ConnectionManager'
import Queries from './schema/Queries'
import SchemaProvider from './sql/SchemaProvider'
import QueryCell from './controls/QueryCell'
import CatalogViewer from './controls/catalog_viewer/CatalogViewer'
import ConnectionDialog from './controls/ConnectionDialog'

const DRAWER_WIDTH = 260

export interface IQueryEditor {
    height: number
}

export default function QueryEditor({ height }: IQueryEditor) {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [connectionDialogOpen, setConnectionDialogOpen] = useState(false)
    const [, setTick] = useState(0)

    const connectionManager = useMemo(() => new ConnectionManager(), [])
    const queries = useMemo(() => new Queries(), [])
    const schemaProvider = useMemo(() => new SchemaProvider(), [])

    // Listen for connection changes to re-render
    useEffect(() => {
        const handler = () => setTick((t) => t + 1)
        connectionManager.addChangeListener(handler)
        return () => connectionManager.removeChangeListener(handler)
    }, [connectionManager])

    const handleToggleDrawer = () => {
        setDrawerOpen((prev) => !prev)
    }

    const handleOpenConnectionDialog = () => {
        setConnectionDialogOpen(true)
    }

    const handleCloseConnectionDialog = () => {
        setConnectionDialogOpen(false)
    }

    const handleGenerateQuery = (query: string, _catalog?: string, _schema?: string) => {
        if (query) {
            const current = queries.getCurrentQuery()
            const existing = current.query?.trim() ? current.query + '\n' : ''
            queries.updateQuery(current.id, { query: existing + query })
        }
    }

    return (
        <Box sx={{ display: 'flex', height, position: 'relative', overflow: 'hidden' }}>
            <Drawer
                sx={{
                    width: drawerOpen ? DRAWER_WIDTH : 0,
                    flexShrink: 0,
                    transition: (theme) =>
                        theme.transitions.create('width', {
                            easing: drawerOpen ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
                            duration: drawerOpen
                                ? theme.transitions.duration.enteringScreen
                                : theme.transitions.duration.leavingScreen,
                        }),
                    '& .MuiDrawer-paper': {
                        width: DRAWER_WIDTH,
                        position: 'absolute',
                        height: '100%',
                    },
                }}
                variant="persistent"
                anchor="left"
                open={drawerOpen}
                slotProps={{ root: { style: { position: 'absolute' } } }}
            >
                <CatalogViewer
                    connectionManager={connectionManager}
                    schemaProvider={schemaProvider}
                    onClose={handleToggleDrawer}
                    onGenerateQuery={handleGenerateQuery}
                />
            </Drawer>

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <QueryCell
                    queries={queries}
                    connectionManager={connectionManager}
                    height={height}
                    onToggleDrawer={handleToggleDrawer}
                    onOpenConnectionDialog={handleOpenConnectionDialog}
                />
            </Box>

            <ConnectionDialog
                open={connectionDialogOpen}
                onClose={handleCloseConnectionDialog}
                connectionManager={connectionManager}
            />
        </Box>
    )
}
