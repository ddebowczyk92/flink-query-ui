import GatewayConnection from './GatewayConnection'
import { FlinkSqlGatewayError } from '../api/FlinkSqlGatewayClient'

const STORAGE_KEY = 'flink_gateway_connections'
const ACTIVE_CONNECTION_KEY = 'flink_active_connection'

/**
 * Manages multiple Flink SQL Gateway connections.
 * Persists connection definitions (not sessions) to localStorage.
 */
class ConnectionManager {
    private connections: Map<string, GatewayConnection> = new Map()
    private activeConnectionId: string | null = null
    private changeListeners: (() => void)[] = []

    constructor() {
        this.loadFromStorage()
    }

    // ── Accessors ──

    getConnections(): GatewayConnection[] {
        return Array.from(this.connections.values())
    }

    getConnection(id: string): GatewayConnection | undefined {
        return this.connections.get(id)
    }

    getActiveConnection(): GatewayConnection | undefined {
        if (this.activeConnectionId) {
            return this.connections.get(this.activeConnectionId)
        }
        return undefined
    }

    getActiveConnectionId(): string | null {
        return this.activeConnectionId
    }

    // ── Mutations ──

    addConnection(name: string, url: string): GatewayConnection {
        const connection = new GatewayConnection(name, url)
        this.connections.set(connection.id, connection)
        if (this.connections.size === 1) {
            this.activeConnectionId = connection.id
        }
        this.saveToStorage()
        this.notifyListeners()
        return connection
    }

    removeConnection(id: string): void {
        const connection = this.connections.get(id)
        if (connection) {
            connection.disconnectAll()
            this.connections.delete(id)
            if (this.activeConnectionId === id) {
                const first = this.connections.values().next()
                this.activeConnectionId = first.done ? null : first.value.id
            }
            this.saveToStorage()
            this.notifyListeners()
        }
    }

    setActiveConnection(id: string): void {
        if (this.connections.has(id)) {
            this.activeConnectionId = id
            localStorage.setItem(ACTIVE_CONNECTION_KEY, id)
            this.notifyListeners()
        }
    }

    async connectActive(properties?: Record<string, string>): Promise<string> {
        const connection = this.getActiveConnection()
        if (!connection) {
            throw new FlinkSqlGatewayError('No active connection selected')
        }
        const sessionHandle = await connection.openSession('default', properties)
        this.notifyListeners()
        return sessionHandle
    }

    async disconnectActive(): Promise<void> {
        const connection = this.getActiveConnection()
        if (connection) {
            await connection.disconnectAll()
            this.notifyListeners()
        }
    }

    // ── Persistence ──

    private saveToStorage(): void {
        const data = Array.from(this.connections.values()).map((c) => c.toJSON())
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        if (this.activeConnectionId) {
            localStorage.setItem(ACTIVE_CONNECTION_KEY, this.activeConnectionId)
        }
    }

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
                const items = JSON.parse(raw) as { id: string; name: string; url: string }[]
                items.forEach((item) => {
                    const connection = GatewayConnection.fromJSON(item)
                    this.connections.set(connection.id, connection)
                })
            }
            const activeId = localStorage.getItem(ACTIVE_CONNECTION_KEY)
            if (activeId && this.connections.has(activeId)) {
                this.activeConnectionId = activeId
            } else if (this.connections.size > 0) {
                this.activeConnectionId = this.connections.values().next().value!.id
            }
        } catch (e) {
            console.error('Error loading connections from storage:', e)
        }
    }

    // ── Listeners ──

    addChangeListener(listener: () => void): void {
        this.changeListeners.push(listener)
    }

    removeChangeListener(listener: () => void): void {
        this.changeListeners = this.changeListeners.filter((l) => l !== listener)
    }

    private notifyListeners(): void {
        this.changeListeners.forEach((listener) => listener())
    }
}

export default ConnectionManager
