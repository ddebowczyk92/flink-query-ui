import React, { useState, useEffect, useRef } from 'react'
import { Alert, AlertTitle, Box, Divider, IconButton, LinearProgress, TextField, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import RefreshIcon from '@mui/icons-material/Refresh'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view'
import ConnectionManager from '../../schema/ConnectionManager'
import Catalog from '../../schema/Catalog'
import SchemaProvider from '../../sql/SchemaProvider'
import { getErrorMessage } from '../../utils/Errors'
import CatalogViewerSchema from './CatalogViewerSchema'
import { ViewerStateManager, buildPath } from './ViewerState'

interface CatalogViewerProps {
    connectionManager: ConnectionManager
    schemaProvider: SchemaProvider
    onClose: () => void
    onGenerateQuery?: (query: string, catalog?: string, schema?: string) => void
}

const CatalogViewer: React.FC<CatalogViewerProps> = ({
    connectionManager,
    schemaProvider,
    onClose,
    onGenerateQuery,
}) => {
    const [catalogs, setCatalogs] = useState<Map<string, Catalog>>(new Map())
    const [errorMessage, setErrorMessage] = useState<string>()
    const [filterText, setFilterText] = useState('')
    const [debouncedFilterText, setDebouncedFilterText] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const [, setMatches] = useState<Set<string>>(new Set())
    const [, setExpandedNodes] = useState<Set<string>>(new Set())
    const viewerState = useRef<ViewerStateManager | null>(null)
    const [, setIsLoadingColumns] = useState(false)

    useEffect(() => {
        viewerState.current = new ViewerStateManager((update) => {
            setMatches(update.matches)
            setExpandedNodes(update.expandedNodes)
        }, setIsLoadingColumns)
    }, [])

    // Debounce filter
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedFilterText(filterText)
        }, 300)
        return () => clearTimeout(timer)
    }, [filterText])

    // Apply search when filter changes
    useEffect(() => {
        if (viewerState.current) {
            viewerState.current.startSearch(debouncedFilterText, false, catalogs, schemaProvider)
        }
    }, [debouncedFilterText, catalogs, schemaProvider])

    const loadCatalogs = async () => {
        const connection = connectionManager.getActiveConnection()
        if (!connection) {
            setErrorMessage('No active connection. Click the connection icon to add one.')
            return
        }

        setIsLoading(true)
        setErrorMessage(undefined)
        schemaProvider.setConnection(connection)

        try {
            await schemaProvider.loadCatalogs(
                (nextCatalogs) => {
                    setCatalogs(nextCatalogs)
                    setIsLoading(false)
                },
                (error: string) => {
                    setErrorMessage(error)
                    setIsLoading(false)
                }
            )
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
            setIsLoading(false)
        }
    }

    // Load catalogs when connection changes
    useEffect(() => {
        const handler = () => {
            const connection = connectionManager.getActiveConnection()
            if (connection) {
                loadCatalogs()
            } else {
                setCatalogs(new Map())
                setErrorMessage(undefined)
            }
        }
        connectionManager.addChangeListener(handler)
        return () => connectionManager.removeChangeListener(handler)
    }, [connectionManager]) // eslint-disable-line react-hooks/exhaustive-deps

    // Initial load
    useEffect(() => {
        if (connectionManager.getActiveConnection()) {
            loadCatalogs()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggle = (_event: React.SyntheticEvent | null, itemId: string) => {
        if (!viewerState.current) return
        viewerState.current.toggleExpanded(itemId)

        // If it's a table path (3 parts), trigger column loading
        const parts = itemId.split('.')
        if (parts.length === 3) {
            schemaProvider.loadTableColumns(parts[0], parts[1], parts[2], () => {
                // Force re-render after columns load
                setMatches((prev) => new Set(prev))
            })
        }
    }

    const isVisible = (path: string): boolean => viewerState.current?.isVisible(path) ?? true

    const hasMatchingChildren = (path: string): boolean => viewerState.current?.hasMatchingChildren(path) ?? false

    const handleSetCatalog = (e: React.MouseEvent, catalogName: string) => {
        e.stopPropagation()
        onGenerateQuery?.(`USE CATALOG \`${catalogName}\``, catalogName)
    }

    const handleSetSchema = (catalogName: string, schemaName: string) => {
        onGenerateQuery?.(`USE \`${catalogName}\`.\`${schemaName}\``, catalogName, schemaName)
    }

    const handleGenerateSelectQuery = (catalogName: string, schemaName: string, tableName: string) => {
        const table = schemaProvider.getTableIfCached(catalogName, schemaName, tableName)
        if (table) {
            const cols = table.getColumnsForSelect() || '*'
            const query = `SELECT ${cols}\nFROM \`${catalogName}\`.\`${schemaName}\`.\`${tableName}\`\nLIMIT 100`
            onGenerateQuery?.(query, catalogName, schemaName)
        } else {
            schemaProvider.loadTableColumns(catalogName, schemaName, tableName, (loadedTable) => {
                const cols = loadedTable.getColumnsForSelect() || '*'
                const query = `SELECT ${cols}\nFROM \`${catalogName}\`.\`${schemaName}\`.\`${tableName}\`\nLIMIT 100`
                onGenerateQuery?.(query, catalogName, schemaName)
            })
        }
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                height: '100%',
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    width: '100%',
                    px: 1,
                    py: 1,
                }}
            >
                <TextField
                    label="Find objects"
                    placeholder="Catalog, schema or table..."
                    size="small"
                    variant="outlined"
                    type="search"
                    sx={{
                        flex: 1,
                        '& .MuiInputBase-input': { fontSize: '0.75rem' },
                        '& .MuiInputBase-input::placeholder': { fontSize: '0.75rem' },
                        '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                    }}
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    fullWidth
                />
                <IconButton title="Refresh" size="small" onClick={loadCatalogs} disabled={isLoading}>
                    <RefreshIcon sx={{ fontSize: '1.2rem' }} />
                </IconButton>
                <IconButton title="Close drawer" size="small" onClick={onClose}>
                    <ChevronLeftIcon sx={{ fontSize: '1.2rem' }} />
                </IconButton>
            </Box>

            <Divider />
            <LinearProgress color="info" sx={{ visibility: isLoading ? 'visible' : 'hidden' }} />

            {errorMessage && (
                <Alert severity="error" sx={{ m: 1 }}>
                    <AlertTitle>Catalog Explorer</AlertTitle>
                    {errorMessage}
                </Alert>
            )}

            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <SimpleTreeView
                    sx={{
                        '& .MuiTreeItem-content': {
                            minHeight: 24,
                            py: 0.2,
                            my: 0,
                            gap: 0.5,
                        },
                    }}
                    onItemExpansionToggle={handleToggle}
                >
                    {Array.from(catalogs.values())
                        .sort((a, b) => a.getName().localeCompare(b.getName()))
                        .map((catalog: Catalog) => {
                            const catalogName = catalog.getName()
                            const catalogPath = buildPath.catalog(catalogName)

                            if (filterText && !isVisible(catalogPath)) {
                                return null
                            }

                            return (
                                <TreeItem
                                    key={catalogPath}
                                    itemId={catalogPath}
                                    slots={{ icon: StorageOutlinedIcon }}
                                    label={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography fontSize="small">{catalogName}</Typography>
                                            <IconButton
                                                title="Set as default catalog"
                                                size="small"
                                                sx={{ ml: 'auto' }}
                                                onClick={(e) => handleSetCatalog(e, catalogName)}
                                                disabled={isLoading}
                                            >
                                                <ChevronRightIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        </Box>
                                    }
                                    slotProps={{
                                        label: { style: { overflow: 'visible' } },
                                    }}
                                >
                                    <Box>
                                        {catalog.getError() && (
                                            <Alert severity="error" sx={{ fontSize: '0.75rem', m: 0.5 }}>
                                                {catalog.getError()}
                                            </Alert>
                                        )}

                                        {Array.from(catalog.getSchemas().values())
                                            .sort((a, b) => a.getName().localeCompare(b.getName()))
                                            .map((schema) => {
                                                const schemaPath = buildPath.schema(catalogName, schema.getName())
                                                return (
                                                    <CatalogViewerSchema
                                                        key={schemaPath}
                                                        catalogName={catalogName}
                                                        schema={schema}
                                                        schemaProvider={schemaProvider}
                                                        filterText={filterText}
                                                        isVisible={isVisible}
                                                        isLoading={isLoading}
                                                        hasMatchingChildren={hasMatchingChildren}
                                                        onSetSchema={handleSetSchema}
                                                        onGenerateQuery={handleGenerateSelectQuery}
                                                    />
                                                )
                                            })}
                                    </Box>
                                </TreeItem>
                            )
                        })}
                </SimpleTreeView>
            </Box>
        </Box>
    )
}

export default CatalogViewer
