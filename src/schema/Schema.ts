import Table from './Table'

class Schema {
    private name: string
    private tables: Map<string, Table> = new Map<string, Table>()

    constructor(name: string) {
        this.name = name
    }

    getName(): string {
        return this.name
    }

    getTables(): Map<string, Table> {
        return this.tables
    }

    addTable(table: Table): void {
        this.tables.set(table.getName(), table)
    }
}

export default Schema
