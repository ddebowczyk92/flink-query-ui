import React from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import { TreeItem } from '@mui/x-tree-view'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import Schema from '../../schema/Schema'
import Table from '../../schema/Table'
import SchemaProvider from '../../sql/SchemaProvider'
import CatalogViewerTable from './CatalogViewerTable'
import { buildPath } from './ViewerState'

interface CatalogViewerSchemaProps {
    catalogName: string
    schema: Schema
    schemaProvider: SchemaProvider
    filterText: string
    isVisible: (path: string) => boolean
    isLoading: boolean
    hasMatchingChildren: (path: string) => boolean
    onSetSchema?: (catalogName: string, schemaName: string) => void
    onGenerateQuery?: (catalogName: string, schemaName: string, tableName: string) => void
}

const CatalogViewerSchema: React.FC<CatalogViewerSchemaProps> = ({
    catalogName,
    schema,
    schemaProvider,
    filterText,
    isVisible,
    isLoading,
    onSetSchema,
    onGenerateQuery,
}) => {
    const schemaPath = buildPath.schema(catalogName, schema.getName())

    if (filterText && !isVisible(schemaPath)) {
        return null
    }

    const handleSetSchema = (e: React.MouseEvent) => {
        e.stopPropagation()
        onSetSchema?.(catalogName, schema.getName())
    }

    return (
        <TreeItem
            itemId={schemaPath}
            slots={{ icon: AccountTreeOutlinedIcon }}
            label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography fontSize="small">{schema.getName()}</Typography>
                    <IconButton
                        title="Set as default database"
                        size="small"
                        sx={{ ml: 'auto' }}
                        onClick={handleSetSchema}
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
            {Array.from(schema.getTables().values())
                .sort((a: Table, b: Table) => a.getName().localeCompare(b.getName()))
                .map((table: Table) => {
                    const tablePath = buildPath.table(catalogName, schema.getName(), table.getName())
                    return (
                        <CatalogViewerTable
                            key={tablePath}
                            catalogName={catalogName}
                            schemaName={schema.getName()}
                            table={table}
                            schemaProvider={schemaProvider}
                            filterText={filterText}
                            isExpanded={isVisible(tablePath)}
                            isVisible={isVisible}
                            isLoading={isLoading}
                            onGenerateQuery={onGenerateQuery}
                        />
                    )
                })}
        </TreeItem>
    )
}

export default CatalogViewerSchema
