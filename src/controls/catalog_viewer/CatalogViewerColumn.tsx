import React from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { TreeItem } from '@mui/x-tree-view'
import Column from '../../schema/Column'
import { buildPath } from './ViewerState'

interface CatalogViewerColumnProps {
    catalogName: string
    schemaName: string
    tableName: string
    column: Column
    isVisible: (path: string) => boolean
}

const CatalogViewerColumn: React.FC<CatalogViewerColumnProps> = ({
    catalogName,
    schemaName,
    tableName,
    column,
    isVisible,
}) => {
    const columnPath = buildPath.column(catalogName, schemaName, tableName, column.getName())

    if (!isVisible(columnPath)) {
        return null
    }

    return (
        <TreeItem
            itemId={columnPath}
            label={
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontSize="small" noWrap>
                        <Box component="span" sx={{ mr: 1 }}>
                            {column.getName()}
                        </Box>
                        <Box
                            component="span"
                            sx={{
                                fontFamily: 'monospace',
                                fontStyle: 'italic',
                                color: 'text.disabled',
                            }}
                        >
                            {column.getType()}
                        </Box>
                    </Typography>
                </Stack>
            }
            slotProps={{
                label: { style: { overflow: 'visible' } },
            }}
        />
    )
}

export default CatalogViewerColumn
