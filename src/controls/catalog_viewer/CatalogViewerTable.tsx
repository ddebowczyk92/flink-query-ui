import React, { useState, useEffect } from 'react'
import { Alert, Box, IconButton, Typography } from '@mui/material'
import { TreeItem } from '@mui/x-tree-view'
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import TableRowsOutlined from '@mui/icons-material/TableRowsOutlined'
import Table from '../../schema/Table'
import SchemaProvider from '../../sql/SchemaProvider'
import CatalogViewerColumn from './CatalogViewerColumn'
import { buildPath } from './ViewerState'

interface CatalogViewerTableProps {
    catalogName: string
    schemaName: string
    table: Table
    schemaProvider: SchemaProvider
    filterText: string
    isExpanded: boolean
    isVisible: (path: string) => boolean
    isLoading: boolean
    onGenerateQuery?: (catalogName: string, schemaName: string, tableName: string) => void
}

const CatalogViewerTable: React.FC<CatalogViewerTableProps> = ({
    catalogName,
    schemaName,
    table,
    schemaProvider,
    filterText,
    isExpanded,
    isVisible,
    isLoading,
    onGenerateQuery,
}) => {
    const [, setTick] = useState(0)
    const tablePath = buildPath.table(catalogName, schemaName, table.getName())

    useEffect(() => {
        if ((isExpanded || filterText) && !table.hasLoadedColumns()) {
            table.setLoading(true)
            setTick((t) => t + 1)
            schemaProvider.loadTableColumns(catalogName, schemaName, table.getName(), () => {
                setTick((t) => t + 1)
            })
        }
    }, [isExpanded, filterText, catalogName, schemaName, table, schemaProvider])

    if (!isVisible(tablePath)) {
        return null
    }

    const handleGenerateQuery = (e: React.MouseEvent) => {
        e.stopPropagation()
        onGenerateQuery?.(catalogName, schemaName, table.getName())
    }

    return (
        <TreeItem
            itemId={tablePath}
            slots={{
                icon: table.isLoading() ? HourglassEmptyOutlinedIcon : TableRowsOutlined,
            }}
            label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography fontSize="small">{table.getName()}</Typography>
                    <IconButton
                        title="Generate SELECT query for this table"
                        size="small"
                        sx={{ ml: 'auto' }}
                        onClick={handleGenerateQuery}
                        disabled={isLoading}
                    >
                        <SearchOutlinedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                </Box>
            }
            slotProps={{
                label: { style: { overflow: 'visible' } },
            }}
        >
            <Box>
                {table.getError() ? (
                    <Alert severity="error" sx={{ fontSize: '0.75rem' }}>
                        {table.getError()}
                    </Alert>
                ) : (
                    table
                        .getColumns()
                        .map((column) => (
                            <CatalogViewerColumn
                                key={buildPath.column(catalogName, schemaName, table.getName(), column.getName())}
                                catalogName={catalogName}
                                schemaName={schemaName}
                                tableName={table.getName()}
                                column={column}
                                isVisible={isVisible}
                            />
                        ))
                )}
            </Box>
        </TreeItem>
    )
}

export default CatalogViewerTable
