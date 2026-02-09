import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, IconButton, Toolbar, Tooltip, Typography, useMediaQuery } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import MenuIcon from '@mui/icons-material/Menu'
import StorageIcon from '@mui/icons-material/Storage'
import FlinkQueryRunner, { QueryState, QueryRunnerCallbacks } from '../api/FlinkQueryRunner'
import { ColumnInfo, RowData } from '../api/FlinkSqlGatewayTypes'
import ConnectionManager from '../schema/ConnectionManager'
import GatewayConnection from '../schema/GatewayConnection'
import Queries from '../schema/Queries'
import QueryInfo from '../schema/QueryInfo'
import { getErrorMessage } from '../utils/Errors'
import splitStatements from '../sql/splitStatements'
import QueryEditorPane, { EditorHandle } from './QueryEditorPane'
import ResizableSplitter, { SPLITTER_HEIGHT } from './ResizableSplitter'
import ResultSet from './ResultSet'

const TOOLBAR_HEIGHT = 48

type SessionState = 'none' | 'connecting' | 'connected' | 'error'

interface QueryCellProps {
    queries: Queries
    connectionManager: ConnectionManager
    height: number
    onToggleDrawer: () => void
    onOpenConnectionDialog: () => void
}

export default function QueryCell({
    queries,
    connectionManager,
    height,
    onToggleDrawer,
    onOpenConnectionDialog,
}: QueryCellProps) {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
    const theme = prefersDarkMode ? 'dark' : 'light'

    const [currentQuery, setCurrentQuery] = useState<QueryInfo>(queries.getCurrentQuery())
    const [queryState, setQueryState] = useState<QueryState>('IDLE')
    const [columns, setColumns] = useState<ColumnInfo[]>([])
    const [rows, setRows] = useState<RowData[]>([])
    const [error, setError] = useState<string | null>(null)
    const [warning, setWarning] = useState<string | null>(null)
    const [jobId, setJobId] = useState<string | null>(null)
    const [isQueryResult, setIsQueryResult] = useState<boolean>(true)
    const [sessionState, setSessionState] = useState<SessionState>('none')
    const [sessionError, setSessionError] = useState<string | null>(null)
    const [statementProgress, setStatementProgress] = useState<{ current: number; total: number } | null>(null)
    const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
        connectionManager.getActiveConnectionId()
    )

    const runnerRef = useRef<FlinkQueryRunner | null>(null)
    const editorHandleRef = useRef<EditorHandle | null>(null)
    const retryCountRef = useRef(0)
    const MAX_SESSION_RETRIES = 1

    // Pending session promise — lets handleExecute await an in-flight session open
    const sessionPromiseRef = useRef<Promise<string> | null>(null)

    // Listen for queries changes
    useEffect(() => {
        const handler = () => setCurrentQuery(queries.getCurrentQuery())
        queries.addChangeListener(handler)
        return () => queries.removeChangeListener(handler)
    }, [queries])

    // Listen for connection changes
    useEffect(() => {
        const handler = () => setActiveConnectionId(connectionManager.getActiveConnectionId())
        connectionManager.addChangeListener(handler)
        return () => connectionManager.removeChangeListener(handler)
    }, [connectionManager])

    // Eagerly open a session when the tab or connection changes
    useEffect(() => {
        const connection = connectionManager.getActiveConnection()
        if (!connection) {
            setSessionState('none')
            setSessionError(null)
            sessionPromiseRef.current = null
            return
        }

        const tabId = currentQuery.id

        // If a session already exists for this tab, mark as connected
        if (connection.hasSession(tabId)) {
            setSessionState('connected')
            setSessionError(null)
            sessionPromiseRef.current = null
            return
        }

        // Open session in the background
        setSessionState('connecting')
        setSessionError(null)

        const promise = connection.openSession(tabId)
        sessionPromiseRef.current = promise

        promise
            .then(() => {
                // Only update state if this is still the current promise
                if (sessionPromiseRef.current === promise) {
                    setSessionState('connected')
                    setSessionError(null)
                }
            })
            .catch((err) => {
                if (sessionPromiseRef.current === promise) {
                    setSessionState('error')
                    setSessionError(getErrorMessage(err))
                }
            })

        return () => {
            // If the tab/connection changes before the promise resolves, discard it
            if (sessionPromiseRef.current === promise) {
                sessionPromiseRef.current = null
            }
        }
    }, [currentQuery.id, connectionManager, activeConnectionId])

    // Re-validate session when browser tab regains focus (sessions may have expired during inactivity)
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return
            const connection = connectionManager.getActiveConnection()
            if (!connection) return
            const tabId = currentQuery.id
            if (!connection.hasSession(tabId)) {
                // Session was dropped (e.g. heartbeat detected expiry but recreate failed)
                setSessionState('connecting')
                setSessionError(null)
                const promise = connection.openSession(tabId)
                sessionPromiseRef.current = promise
                promise
                    .then(() => {
                        if (sessionPromiseRef.current === promise) {
                            setSessionState('connected')
                            setSessionError(null)
                        }
                    })
                    .catch((err) => {
                        if (sessionPromiseRef.current === promise) {
                            setSessionState('error')
                            setSessionError(getErrorMessage(err))
                        }
                    })
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        return () => document.removeEventListener('visibilitychange', handleVisibility)
    }, [currentQuery.id, connectionManager])

    const executeWithSession = useCallback(
        async (connection: GatewayConnection, query: QueryInfo, sessionHandle: string) => {
            const text = query.query?.trim()
            if (!text) return

            const statements = splitStatements(text)
            if (statements.length === 0) return

            // Cancel any in-flight runner before starting a new one
            if (runnerRef.current && runnerRef.current.isRunning()) {
                await runnerRef.current.cancel()
            }

            // Reset state
            setColumns([])
            setRows([])
            setError(null)
            setWarning(null)
            setJobId(null)
            setIsQueryResult(true)
            setStatementProgress(null)

            const callbacks: QueryRunnerCallbacks = {
                onStateChange: (state) => setQueryState(state),
                onColumnsReceived: (cols) => setColumns(cols),
                onRowsReceived: (allRows) => setRows([...allRows]),
                onError: (msg) => setError(msg),
                onWarning: (msg) => setWarning(msg),
                onJobId: (id) => setJobId(id),
                onIsQueryResult: (isQuery) => setIsQueryResult(isQuery),
                onStatementProgress: (current, total) => setStatementProgress({ current, total }),
                onSessionExpired: async () => {
                    if (retryCountRef.current >= MAX_SESSION_RETRIES) {
                        setError('Session expired. Please try again.')
                        setQueryState('FAILED')
                        setSessionState('error')
                        setSessionError('Session expired')
                        return
                    }
                    retryCountRef.current++
                    try {
                        setSessionState('connecting')
                        const newHandle = await connection.recreateSession(query.id)
                        setSessionState('connected')
                        setSessionError(null)
                        await executeWithSession(connection, query, newHandle)
                    } catch (err) {
                        const msg = getErrorMessage(err)
                        setError(msg)
                        setQueryState('FAILED')
                        setSessionState('error')
                        setSessionError(msg)
                    }
                },
            }

            const runner = new FlinkQueryRunner(connection.client, sessionHandle, callbacks)
            runnerRef.current = runner
            await runner.executeAll(statements)
        },
        []
    )

    const handleExecute = useCallback(
        async (statementOverride?: string) => {
            const connection = connectionManager.getActiveConnection()
            if (!connection) {
                setError('No gateway connection selected. Click the connection icon to add one.')
                return
            }

            const query = queries.getCurrentQuery()
            const statement = statementOverride?.trim() || query.query?.trim()
            if (!statement) {
                setError('No SQL statement to execute')
                return
            }

            // Use the eagerly-opened session, or wait for it if still connecting
            let sessionHandle: string | null = connection.getSessionHandle(query.id)
            if (!sessionHandle && sessionPromiseRef.current) {
                try {
                    sessionHandle = await sessionPromiseRef.current
                } catch {
                    // Fall through to manual open below
                }
            }
            if (!sessionHandle) {
                try {
                    setSessionState('connecting')
                    sessionHandle = await connection.openSession(query.id)
                    setSessionState('connected')
                    setSessionError(null)
                } catch (err) {
                    const msg = getErrorMessage(err)
                    setSessionState('error')
                    setSessionError(msg)
                    setError(msg)
                    return
                }
            }

            retryCountRef.current = 0
            await executeWithSession(connection, { ...query, query: statement }, sessionHandle)
        },
        [connectionManager, queries, executeWithSession]
    )

    const handleCancel = useCallback(async () => {
        if (runnerRef.current) {
            await runnerRef.current.cancel()
        }
    }, [])

    const handleTabClose = useCallback(
        (tabId: string) => {
            const connection = connectionManager.getActiveConnection()
            if (connection) {
                connection.closeSession(tabId)
            }
        },
        [connectionManager]
    )

    const isRunning = queryState === 'SUBMITTING' || queryState === 'RUNNING' || queryState === 'CANCELLING'
    const activeConnection = connectionManager.getActiveConnection()
    const contentHeight = height - TOOLBAR_HEIGHT

    return (
        <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <Toolbar
                variant="dense"
                sx={{
                    minHeight: TOOLBAR_HEIGHT,
                    maxHeight: TOOLBAR_HEIGHT,
                    px: 1,
                    gap: 0.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                <IconButton size="small" onClick={onToggleDrawer} edge="start">
                    <MenuIcon fontSize="small" />
                </IconButton>

                {isRunning ? (
                    <IconButton
                        size="small"
                        onClick={handleCancel}
                        color="error"
                        disabled={queryState === 'CANCELLING'}
                    >
                        <StopIcon fontSize="small" />
                    </IconButton>
                ) : (
                    <IconButton
                        size="small"
                        onClick={() => handleExecute(editorHandleRef.current?.getSelectedText())}
                        color="primary"
                    >
                        <PlayArrowIcon fontSize="small" />
                    </IconButton>
                )}

                <Typography variant="body2" sx={{ fontWeight: 500, ml: 1 }}>
                    {currentQuery.title}
                </Typography>

                <Box sx={{ flex: 1 }} />

                <IconButton size="small" onClick={onOpenConnectionDialog}>
                    <StorageIcon fontSize="small" />
                </IconButton>
                {activeConnection && (
                    <Tooltip
                        title={
                            sessionState === 'connecting'
                                ? 'Connecting to gateway...'
                                : sessionState === 'connected'
                                  ? 'Session active'
                                  : sessionState === 'error'
                                    ? sessionError || 'Connection error'
                                    : ''
                        }
                    >
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor:
                                    sessionState === 'connected'
                                        ? 'success.main'
                                        : sessionState === 'error'
                                          ? 'error.main'
                                          : sessionState === 'connecting'
                                            ? 'warning.main'
                                            : 'action.disabled',
                                flexShrink: 0,
                            }}
                        />
                    </Tooltip>
                )}
                {sessionState === 'connecting' && <CircularProgress size={14} sx={{ ml: 0.5 }} />}
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                    {activeConnection ? activeConnection.name : 'No connection'}
                </Typography>
            </Toolbar>

            {/* Editor / Results with draggable splitter */}
            <ResizableSplitter
                totalHeight={contentHeight}
                defaultFraction={0.45}
                topContent={(editorHeight) => (
                    <QueryEditorPane
                        queries={queries}
                        currentQuery={currentQuery}
                        height={editorHeight}
                        theme={theme}
                        onExecute={handleExecute}
                        onCancel={handleCancel}
                        onTabClose={handleTabClose}
                        editorHandleRef={editorHandleRef}
                    />
                )}
                bottomContent={(resultHeight) => (
                    <ResultSet
                        state={queryState}
                        columns={columns}
                        rows={rows}
                        error={error}
                        warning={warning}
                        jobId={jobId}
                        isQueryResult={isQueryResult}
                        height={resultHeight}
                        statementProgress={statementProgress}
                    />
                )}
            />
        </Box>
    )
}
