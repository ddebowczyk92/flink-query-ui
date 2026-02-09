import Catalog from '../../schema/Catalog'
import SchemaProvider from '../../sql/SchemaProvider'
import Table from '../../schema/Table'

export interface ViewerStateUpdate {
    expandedNodes: Set<string>
    matches: Set<string>
}

export type StateUpdateCallback = (update: ViewerStateUpdate) => void

export const buildPath = {
    catalog: (catalogName: string) => catalogName,
    schema: (catalogName: string, schemaName: string) => `${catalogName}.${schemaName}`,
    table: (catalogName: string, schemaName: string, tableName: string) => `${catalogName}.${schemaName}.${tableName}`,
    column: (catalogName: string, schemaName: string, tableName: string, columnName: string) =>
        `${catalogName}.${schemaName}.${tableName}.${columnName}`,
}

export class ViewerStateManager {
    public userExpanded = new Set<string>()
    private matches = new Set<string>()
    private onStateUpdate: StateUpdateCallback
    private isSearching = false
    private onLoadingChange: (loading: boolean) => void

    constructor(onStateUpdate: StateUpdateCallback, onLoadingChange: (loading: boolean) => void) {
        this.onStateUpdate = onStateUpdate
        this.onLoadingChange = onLoadingChange
    }

    startSearch(
        filterText: string,
        includeColumns: boolean,
        catalogs: Map<string, Catalog>,
        schemaProvider: SchemaProvider
    ): void {
        this.matches.clear()
        this.isSearching = !!filterText

        if (!filterText) {
            this.notifyStateUpdate()
            return
        }

        const filterItem = (name: string) => name.toLowerCase().includes(filterText.toLowerCase())

        const tablesToLoad: { catalogName: string; schemaName: string; tableName: string }[] = []

        catalogs.forEach((catalog, catalogName) => {
            if (filterItem(catalogName)) {
                this.matches.add(buildPath.catalog(catalogName))
            }

            catalog.getSchemas().forEach((schema) => {
                const schemaPath = buildPath.schema(catalogName, schema.getName())
                if (filterItem(schema.getName())) {
                    this.matches.add(schemaPath)
                }

                schema.getTables().forEach((table) => {
                    const tablePath = buildPath.table(catalogName, schema.getName(), table.getName())
                    if (filterItem(table.getName())) {
                        this.matches.add(tablePath)
                    }

                    if (includeColumns) {
                        if (table.getColumns().length === 0 && !table.hasLoadedColumns()) {
                            tablesToLoad.push({
                                catalogName,
                                schemaName: schema.getName(),
                                tableName: table.getName(),
                            })
                        } else {
                            this.searchTableColumns(table, catalogName, schema.getName(), filterItem)
                        }
                    }
                })
            })
        })

        if (tablesToLoad.length > 0) {
            this.loadTablesSequentially(tablesToLoad, filterItem, schemaProvider)
        }

        this.notifyStateUpdate()
    }

    private loadTablesSequentially(
        tablesToLoad: { catalogName: string; schemaName: string; tableName: string }[],
        filterItem: (name: string) => boolean,
        schemaProvider: SchemaProvider
    ): void {
        if (tablesToLoad.length === 0) {
            this.onLoadingChange(false)
            return
        }

        this.onLoadingChange(true)

        const loadNext = (index: number) => {
            if (index >= tablesToLoad.length) {
                this.onLoadingChange(false)
                return
            }

            const { catalogName, schemaName, tableName } = tablesToLoad[index]
            schemaProvider.loadTableColumns(catalogName, schemaName, tableName, (loadedTable: Table) => {
                this.searchTableColumns(loadedTable, catalogName, schemaName, filterItem)
                this.notifyStateUpdate()
                loadNext(index + 1)
            })
        }

        loadNext(0)
    }

    private searchTableColumns(
        table: Table,
        catalogName: string,
        schemaName: string,
        filterItem: (name: string) => boolean
    ): void {
        table.getColumns().forEach((column) => {
            if (filterItem(column.getName())) {
                const columnPath = buildPath.column(catalogName, schemaName, table.getName(), column.getName())
                this.matches.add(columnPath)
            }
        })
    }

    toggleExpanded(path: string): void {
        if (this.userExpanded.has(path)) {
            this.userExpanded.delete(path)
        } else {
            this.userExpanded.add(path)
        }
        this.notifyStateUpdate()
    }

    isVisible(path: string): boolean {
        if (!this.isSearching) {
            const segments = path.split('.')
            for (let i = 1; i < segments.length; i++) {
                const parentPath = segments.slice(0, i).join('.')
                if (!this.userExpanded.has(parentPath)) {
                    return false
                }
            }
            return true
        }

        return this.matches.has(path) || this.hasMatchingChildren(path)
    }

    isExpanded(path: string): boolean {
        return this.userExpanded.has(path)
    }

    hasMatchingChildren(path: string): boolean {
        if (!this.isSearching) return false
        const prefix = path + '.'
        return Array.from(this.matches).some((match) => match.startsWith(prefix))
    }

    private notifyStateUpdate(): void {
        this.onStateUpdate({
            expandedNodes: new Set(this.userExpanded),
            matches: this.matches,
        })
    }
}
