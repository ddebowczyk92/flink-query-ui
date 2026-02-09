import React, { useEffect, useMemo, useRef } from 'react'
import { Alert, Box, CircularProgress, LinearProgress, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { ColumnInfo, RowData } from '../api/FlinkSqlGatewayTypes'
import { QueryState } from '../api/FlinkQueryRunner'

const MIN_COL_WIDTH = 80
const MAX_COL_WIDTH = 500
const CHAR_WIDTH = 8
const CELL_PADDING = 24
const SAMPLE_ROWS = 100
const ROW_NUM_COL_WIDTH = 56

interface ResultSetProps {
    state: QueryState
    columns: ColumnInfo[]
    rows: RowData[]
    error: string | null
    warning: string | null
    jobId: string | null
    isQueryResult: boolean
    height: number
    statementProgress: { current: number; total: number } | null
}

function estimateColumnWidth(headerName: string, rows: RowData[], colIndex: number): number {
    let maxLen = headerName.length
    const limit = Math.min(rows.length, SAMPLE_ROWS)
    for (let i = 0; i < limit; i++) {
        const val = rows[i].fields[colIndex]
        if (val == null) continue
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
        if (str.length > maxLen) maxLen = str.length
    }
    return Math.min(Math.max(maxLen * CHAR_WIDTH + CELL_PADDING, MIN_COL_WIDTH), MAX_COL_WIDTH)
}

function formatCellValue(val: unknown): string | null {
    if (val === null || val === undefined) return null
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
}

export default function ResultSet({
    state,
    columns,
    rows,
    error,
    warning,
    jobId,
    isQueryResult,
    height,
    statementProgress,
}: ResultSetProps) {
    const isRunning = state === 'SUBMITTING' || state === 'RUNNING' || state === 'CANCELLING'
    const progressPrefix =
        statementProgress && statementProgress.total > 1
            ? `[${statementProgress.current}/${statementProgress.total}] `
            : ''

    const statusText = (): string => {
        if (state === 'IDLE') return 'Ready'
        if (state === 'SUBMITTING') return `${progressPrefix}Submitting...`
        if (state === 'RUNNING')
            return `${progressPrefix}Running${rows.length > 0 ? ` — ${rows.length.toLocaleString()} rows` : ''}...`
        if (state === 'CANCELLING') return `${progressPrefix}Cancelling...`
        if (state === 'CANCELLED') return `${progressPrefix}Cancelled`
        if (state === 'FAILED') return `${progressPrefix}Failed`
        if (state === 'FINISHED') {
            if (!isQueryResult) {
                if (statementProgress && statementProgress.total > 1) {
                    return `${statementProgress.total} statements executed successfully`
                }
                return 'Statement executed successfully'
            }
            return `${progressPrefix}${rows.length.toLocaleString()} rows`
        }
        return ''
    }

    const ddlResultText = (): string => {
        if (rows.length > 0 && rows[0].fields.length > 0) {
            return String(rows[0].fields[0])
        }
        return 'OK'
    }

    // Snapshot rows for width estimation: capture the first batch when columns arrive,
    // so subsequent row updates don't recalculate widths and reset user resizes.
    const widthSnapshotRef = useRef<RowData[]>([])
    useEffect(() => {
        if (columns.length > 0 && rows.length > 0 && widthSnapshotRef.current.length === 0) {
            widthSnapshotRef.current = rows.slice(0, SAMPLE_ROWS)
        }
        if (columns.length === 0) {
            widthSnapshotRef.current = []
        }
    }, [columns, rows])

    // Column definitions only recompute when column metadata changes — not on every row update.
    // The width snapshot ref is read but not a dependency, so widths are locked after first batch.
    const gridColumns: GridColDef[] = useMemo(() => {
        const snapshot = widthSnapshotRef.current

        const rowNumCol: GridColDef = {
            field: '__rowNum',
            headerName: '#',
            width: ROW_NUM_COL_WIDTH,
            minWidth: ROW_NUM_COL_WIDTH,
            maxWidth: ROW_NUM_COL_WIDTH,
            resizable: false,
            sortable: false,
            disableColumnMenu: true,
            renderCell: (params) => params.row.__rowId + 1,
        }

        const dataCols: GridColDef[] = columns.map((col, i) => ({
            field: col.name,
            headerName: col.name,
            width: estimateColumnWidth(col.name, snapshot, i),
            minWidth: MIN_COL_WIDTH,
            resizable: true,
            renderCell: (params) => {
                const val = params.value
                if (val === null || val === undefined) {
                    return (
                        <Typography
                            component="span"
                            variant="inherit"
                            sx={{ color: 'text.disabled', fontStyle: 'italic' }}
                        >
                            null
                        </Typography>
                    )
                }
                return String(val)
            },
        }))

        return [rowNumCol, ...dataCols]
    }, [columns])

    const gridRows = useMemo(
        () =>
            rows.map((row, i) => {
                const obj: Record<string, any> = { __rowId: i }
                columns.forEach((col, j) => {
                    obj[col.name] = formatCellValue(row.fields[j])
                })
                return obj
            }),
        [columns, rows]
    )

    return (
        <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
            {/* Status bar */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 0.5,
                    minHeight: 32,
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                {isRunning && <CircularProgress size={14} />}
                <Typography variant="caption" color="text.secondary">
                    {statusText()}
                </Typography>
                {jobId && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        Job: {jobId}
                    </Typography>
                )}
            </Box>

            {/* Progress bar */}
            {isRunning && <LinearProgress sx={{ height: 2 }} />}

            {/* Error */}
            {error && (
                <Alert
                    severity="error"
                    sx={{
                        mx: 1,
                        mt: 0.5,
                        py: 0,
                        flex: 1,
                        minHeight: 0,
                        overflow: 'auto',
                        alignItems: 'flex-start',
                        '& .MuiAlert-message': {
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        },
                    }}
                >
                    {error}
                </Alert>
            )}

            {/* Warning */}
            {warning && !error && (
                <Alert
                    severity="warning"
                    sx={{
                        mx: 1,
                        mt: 0.5,
                        py: 0,
                    }}
                >
                    {warning}
                </Alert>
            )}

            {/* Data grid (only for query results) */}
            {isQueryResult && columns.length > 0 && (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                    <DataGrid
                        rows={gridRows}
                        columns={gridColumns}
                        getRowId={(row) => row.__rowId}
                        density="compact"
                        disableRowSelectionOnClick
                        hideFooterSelectedRowCount
                        columnBufferPx={200}
                        sx={{
                            border: 'none',
                            '& .MuiDataGrid-cell': {
                                fontSize: '0.8rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            },
                            // Row number column styling
                            '& .MuiDataGrid-cell[data-field="__rowNum"]': {
                                color: 'text.disabled',
                                fontSize: '0.75rem',
                                borderRight: 1,
                                borderColor: 'divider',
                            },
                            '& .MuiDataGrid-columnHeader[data-field="__rowNum"]': {
                                borderRight: 1,
                                borderColor: 'divider',
                            },
                            // Column separator visible for resize handles
                            '& .MuiDataGrid-columnSeparator': {
                                visibility: 'visible',
                            },
                        }}
                    />
                </Box>
            )}

            {/* DDL success display */}
            {!isQueryResult && (state === 'FINISHED' || state === 'CANCELLED') && (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleOutlineIcon color="success" />
                        <Typography variant="body2" color="text.secondary">
                            {ddlResultText()}
                        </Typography>
                    </Box>
                </Box>
            )}

            {/* Empty state */}
            {state === 'IDLE' && columns.length === 0 && !error && (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        Execute a query to see results
                    </Typography>
                </Box>
            )}
        </Box>
    )
}
