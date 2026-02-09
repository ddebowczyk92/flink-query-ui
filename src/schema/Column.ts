class Column {
    private name: string
    private type: string
    private comment: string

    constructor(name: string, type: string, comment: string = '') {
        this.name = name
        this.type = type
        this.comment = comment
    }

    getName(): string {
        return this.name
    }

    getType(): string {
        return this.type
    }

    getComment(): string {
        return this.comment
    }
}

export default Column
