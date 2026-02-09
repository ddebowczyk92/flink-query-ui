import Column from './Column'

class Table {
    private name: string
    private columns: Column[] = []
    private error: string = ''
    private isLoadingColumns: boolean = false

    constructor(name: string) {
        this.name = name
    }

    getName(): string {
        return this.name
    }

    getColumns(): Column[] {
        return this.columns
    }

    setColumns(columns: Column[]): void {
        this.columns = columns
        this.isLoadingColumns = false
    }

    getError(): string {
        return this.error
    }

    setError(error: string): void {
        this.error = error
        this.isLoadingColumns = false
    }

    isLoading(): boolean {
        return this.isLoadingColumns
    }

    setLoading(loading: boolean): void {
        this.isLoadingColumns = loading
    }

    hasLoadedColumns(): boolean {
        return this.columns.length > 0 || this.error !== ''
    }

    getColumnsForSelect(): string {
        return this.columns.map((column) => column.getName()).join(', ')
    }
}

export default Table
