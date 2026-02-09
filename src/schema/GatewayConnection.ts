import { v4 as uuidv4 } from 'uuid'
import FlinkSqlGatewayClient from '../api/FlinkSqlGatewayClient'
import { isSessionExpired } from '../utils/Errors'

export interface GatewayConnectionInfo {
    id: string
    name: string
    url: string
}

/**
 * Represents a connection to a single Flink SQL Gateway instance.
 * Manages multiple sessions (one per tab) with independent heartbeats.
 */
class GatewayConnection {
    readonly id: string
    readonly name: string
    readonly url: string
    readonly client: FlinkSqlGatewayClient

    private sessions: Map<string, string> = new Map() // tabId -> sessionHandle
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null
    private visibilityHandler: (() => void) | null = null
    private static readonly HEARTBEAT_INTERVAL_MS = 30_000

    constructor(name: string, url: string, id?: string) {
        this.id = id ?? uuidv4()
        this.name = name
        this.url = url
        this.client = new FlinkSqlGatewayClient(url)
    }

    getSessionHandle(tabId: string): string | null {
        return this.sessions.get(tabId) ?? null
    }

    hasSession(tabId: string): boolean {
        return this.sessions.has(tabId)
    }

    async openSession(tabId: string, properties?: Record<string, string>): Promise<string> {
        const existing = this.sessions.get(tabId)
        if (existing) {
            return existing
        }

        const response = await this.client.openSession({
            sessionName: `tab-${tabId}`,
            properties,
        })
        this.sessions.set(tabId, response.sessionHandle)
        this.ensureHeartbeat()
        return response.sessionHandle
    }

    async closeSession(tabId: string): Promise<void> {
        const sessionHandle = this.sessions.get(tabId)
        if (!sessionHandle) return

        this.sessions.delete(tabId)
        try {
            await this.client.closeSession(sessionHandle)
        } catch (error) {
            console.error('Error closing session:', error)
        }
        if (this.sessions.size === 0) {
            this.stopHeartbeat()
        }
    }

    async recreateSession(tabId: string): Promise<string> {
        this.sessions.delete(tabId)
        const response = await this.client.openSession({
            sessionName: `tab-${tabId}`,
        })
        this.sessions.set(tabId, response.sessionHandle)
        this.ensureHeartbeat()
        return response.sessionHandle
    }

    async disconnectAll(): Promise<void> {
        this.stopHeartbeat()
        const entries = Array.from(this.sessions.entries())
        this.sessions.clear()
        for (const [, sessionHandle] of entries) {
            try {
                await this.client.closeSession(sessionHandle)
            } catch (error) {
                console.error('Error closing session:', error)
            }
        }
    }

    private ensureHeartbeat(): void {
        if (!this.heartbeatInterval) {
            this.heartbeatInterval = setInterval(() => this.pingAllSessions(), GatewayConnection.HEARTBEAT_INTERVAL_MS)
        }
        if (!this.visibilityHandler) {
            this.visibilityHandler = () => {
                if (document.visibilityState === 'visible' && this.sessions.size > 0) {
                    this.pingAllSessions()
                }
            }
            document.addEventListener('visibilitychange', this.visibilityHandler)
        }
    }

    private async pingAllSessions(): Promise<void> {
        for (const [tabId, sessionHandle] of this.sessions) {
            try {
                await this.client.heartbeat(sessionHandle)
            } catch (error) {
                if (isSessionExpired(error)) {
                    console.warn(`Session expired for tab ${tabId}, recreating...`)
                    try {
                        await this.recreateSession(tabId)
                    } catch (recreateError) {
                        console.error('Failed to recreate session:', recreateError)
                    }
                } else {
                    console.error('Heartbeat failed:', error)
                }
            }
        }
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler)
            this.visibilityHandler = null
        }
    }

    toInfo(): GatewayConnectionInfo {
        return {
            id: this.id,
            name: this.name,
            url: this.url,
        }
    }

    toJSON(): { id: string; name: string; url: string } {
        return { id: this.id, name: this.name, url: this.url }
    }

    static fromJSON(json: { id: string; name: string; url: string }): GatewayConnection {
        return new GatewayConnection(json.name, json.url, json.id)
    }
}

export default GatewayConnection
