import Schema from './Schema'

class Catalog {
    private name: string
    private errorMessage: string = ''
    private schemas: Map<string, Schema> = new Map<string, Schema>()

    constructor(name: string) {
        this.name = name
    }

    getName(): string {
        return this.name
    }

    getOrAdd(schema: Schema): Schema {
        if (!this.schemas.has(schema.getName())) {
            this.schemas.set(schema.getName(), schema)
        }
        return this.schemas.get(schema.getName()) as Schema
    }

    getSchemas(): Map<string, Schema> {
        return this.schemas
    }

    setErrorMessage(error: string): void {
        this.errorMessage = error
    }

    clearErrorMessage(): void {
        this.errorMessage = ''
    }

    getError(): string {
        return this.errorMessage
    }
}

export default Catalog
