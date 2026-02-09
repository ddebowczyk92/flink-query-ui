import FlinkSqlGatewayClient from '../api/FlinkSqlGatewayClient'
import { FetchResultsResponseBody } from '../api/FlinkSqlGatewayTypes'
import Catalog from '../schema/Catalog'
import Column from '../schema/Column'
import GatewayConnection from '../schema/GatewayConnection'
import Schema from '../schema/Schema'
import Table from '../schema/Table'
import { getErrorMessage, isSessionExpired, parseNextToken } from '../utils/Errors'

const CATALOG_SESSION_ID = '__catalog_viewer__'

class SchemaProvider {
    private connection: GatewayConnection | null = null
    private tables: Map<string, Table> = new Map()

    setConnection(connection: GatewayConnection | null): void {
        if (this.connection && this.connection !== connection) {
            this.connection.closeSession(CATALOG_SESSION_ID)
        }
        this.connection = connection
        this.tables.clear()
    }

    async loadCatalogs(
        onSuccess: (catalogs: Map<string, Catalog>) => void,
        onError: (error: string) => void
    ): Promise<void> {
        if (!this.connection) {
            onError('No active connection')
            return
        }

        try {
            const sessionHandle = await this.ensureSession()
            const client = this.connection.client

            const catalogRows = await this.executeAndCollect(client, sessionHandle, 'SHOW CATALOGS')
            const catalogs = new Map<string, Catalog>()

            for (const row of catalogRows) {
                const catalogName = String(row[0])
                catalogs.set(catalogName, new Catalog(catalogName))
            }

            // For each catalog, load databases (schemas) and tables
            const catalogEntries = Array.from(catalogs.entries())
            for (const [catalogName, catalog] of catalogEntries) {
                try {
                    const dbRows = await this.executeAndCollect(
                        client,
                        sessionHandle,
                        `SHOW DATABASES IN \`${catalogName}\``
                    )
                    for (const dbRow of dbRows) {
                        const schemaName = String(dbRow[0])
                        const schema = catalog.getOrAdd(new Schema(schemaName))

                        try {
                            const tableRows = await this.executeAndCollect(
                                client,
                                sessionHandle,
                                `SHOW TABLES IN \`${catalogName}\`.\`${schemaName}\``
                            )
                            for (const tableRow of tableRows) {
                                const tableName = String(tableRow[0])
                                const table = new Table(tableName)
                                schema.addTable(table)
                                this.tables.set(`${catalogName}.${schemaName}.${tableName}`, table)
                            }
                        } catch (tableErr) {
                            console.error(`Error loading tables for ${catalogName}.${schemaName}:`, tableErr)
                        }
                    }
                } catch (dbErr) {
                    catalog.setErrorMessage(getErrorMessage(dbErr))
                    console.error(`Error loading databases for ${catalogName}:`, dbErr)
                }

                // Notify after each catalog so the UI updates progressively
                onSuccess(new Map(catalogs))
            }

            onSuccess(new Map(catalogs))
        } catch (error) {
            if (isSessionExpired(error) && this.connection) {
                try {
                    await this.connection.recreateSession(CATALOG_SESSION_ID)
                    return this.loadCatalogs(onSuccess, onError)
                } catch (retryErr) {
                    onError(getErrorMessage(retryErr))
                    return
                }
            }
            onError(getErrorMessage(error))
        }
    }

    async loadTableColumns(
        catalogName: string,
        schemaName: string,
        tableName: string,
        onLoaded: (table: Table) => void
    ): Promise<void> {
        const key = `${catalogName}.${schemaName}.${tableName}`
        const cached = this.tables.get(key)

        if (cached && cached.hasLoadedColumns()) {
            onLoaded(cached)
            return
        }

        if (!this.connection) return

        const table = cached ?? new Table(tableName)
        table.setLoading(true)

        try {
            const sessionHandle = await this.ensureSession()
            const client = this.connection.client

            const rows = await this.executeAndCollect(
                client,
                sessionHandle,
                `DESCRIBE \`${catalogName}\`.\`${schemaName}\`.\`${tableName}\``
            )

            const columns: Column[] = rows.map((row) => {
                const colName = String(row[0])
                const colType = String(row[1])
                const comment = row.length > 5 ? String(row[5] ?? '') : ''
                return new Column(colName, colType, comment)
            })

            table.setColumns(columns)
            this.tables.set(key, table)
            onLoaded(table)
        } catch (error) {
            if (isSessionExpired(error) && this.connection) {
                try {
                    await this.connection.recreateSession(CATALOG_SESSION_ID)
                    table.setLoading(false)
                    return this.loadTableColumns(catalogName, schemaName, tableName, onLoaded)
                } catch {
                    // Fall through to set error on the table
                }
            }
            table.setError(getErrorMessage(error))
            onLoaded(table)
        }
    }

    getTableIfCached(catalogName: string, schemaName: string, tableName: string): Table | undefined {
        const key = `${catalogName}.${schemaName}.${tableName}`
        const table = this.tables.get(key)
        if (table && table.hasLoadedColumns()) {
            return table
        }
        return undefined
    }

    private async ensureSession(): Promise<string> {
        if (!this.connection) {
            throw new Error('No active connection')
        }
        return this.connection.openSession(CATALOG_SESSION_ID)
    }

    private async executeAndCollect(
        client: FlinkSqlGatewayClient,
        sessionHandle: string,
        statement: string
    ): Promise<unknown[][]> {
        const execResponse = await client.executeStatement(sessionHandle, { statement })
        const operationHandle = execResponse.operationHandle
        const allRows: unknown[][] = []
        let token = 0

        while (true) {
            const result: FetchResultsResponseBody = await client.fetchResults(
                sessionHandle,
                operationHandle,
                token,
                'JSON'
            )

            if (result.resultType === 'NOT_READY') {
                await new Promise((resolve) => setTimeout(resolve, 100))
                continue
            }

            if (result.resultType === 'PAYLOAD' && result.results?.data) {
                for (const row of result.results.data) {
                    allRows.push(row.fields)
                }
            }

            if (result.resultType === 'EOS') {
                break
            }

            token = parseNextToken(result.nextResultUri, token)
        }

        try {
            await client.closeOperation(sessionHandle, operationHandle)
        } catch {
            // ignore close errors
        }

        return allRows
    }
}

export default SchemaProvider
