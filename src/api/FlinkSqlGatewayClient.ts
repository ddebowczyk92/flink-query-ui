import {
    GetApiVersionResponseBody,
    GetInfoResponseBody,
    OpenSessionRequestBody,
    OpenSessionResponseBody,
    GetSessionConfigResponseBody,
    CloseSessionResponseBody,
    ConfigureSessionRequestBody,
    ExecuteStatementRequestBody,
    ExecuteStatementResponseBody,
    OperationStatusResponseBody,
    FetchResultsResponseBody,
    RowFormat,
    CompleteStatementRequestBody,
    CompleteStatementResponseBody,
} from './FlinkSqlGatewayTypes'
import { extractErrorMessage } from '../utils/Errors'

const API_VERSION = 'v4'
const DEFAULT_TIMEOUT_MS = 30_000

class FlinkSqlGatewayError extends Error {
    public readonly sessionExpired: boolean

    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly statusText?: string,
        sessionExpired = false
    ) {
        super(message)
        this.name = 'FlinkSqlGatewayError'
        this.sessionExpired = sessionExpired
    }
}

/**
 * Low-level HTTP client for the Flink SQL Gateway REST API v4.
 *
 * Each method maps 1-to-1 to an API endpoint. Higher-level orchestration
 * (polling, result aggregation) lives in FlinkQueryRunner.
 */
class FlinkSqlGatewayClient {
    private readonly baseUrl: string

    constructor(gatewayUrl: string) {
        // Strip trailing slash, prepend API version prefix
        const base = gatewayUrl.replace(/\/+$/, '')
        this.baseUrl = `${base}/${API_VERSION}`
    }

    // ── Helpers ──

    private async request<T>(
        path: string,
        options: RequestInit = {},
        timeoutMs: number = DEFAULT_TIMEOUT_MS,
        externalSignal?: AbortSignal,
        overrideUrl?: string
    ): Promise<T> {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort('Request timed out'), timeoutMs)

        // If an external signal is provided, abort our controller when it fires
        const onExternalAbort = () => controller.abort('Cancelled')
        if (externalSignal) {
            if (externalSignal.aborted) {
                controller.abort('Cancelled')
            } else {
                externalSignal.addEventListener('abort', onExternalAbort, { once: true })
            }
        }

        try {
            const url = overrideUrl || `${this.baseUrl}${path}`
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            })

            if (!response.ok) {
                let detail = ''
                try {
                    detail = await response.text()
                } catch {
                    // ignore body read failure
                }
                throw new FlinkSqlGatewayError(
                    detail || `${response.statusText} (${response.status})`,
                    response.status,
                    response.statusText
                )
            }

            // Some endpoints return 200 with no body (e.g. configureSession, heartbeat)
            const text = await response.text()
            if (!text) {
                return undefined as T
            }
            const body = JSON.parse(text)

            // The gateway can return 200 with an errors array for operation-level failures.
            // errors[0] is often a generic message like "Internal server error."
            // errors[1] (if present) contains the full Java stack trace with the root cause.
            if (body.errors && Array.isArray(body.errors) && body.errors.length > 0) {
                const allErrors = body.errors as string[]
                const fullText = allErrors.join('\n')
                const sessionExpired = /Session '[\w-]+' does not exist/.test(fullText)
                throw new FlinkSqlGatewayError(extractErrorMessage(fullText), undefined, undefined, sessionExpired)
            }

            return body as T
        } catch (error) {
            if (error instanceof FlinkSqlGatewayError) {
                throw error
            }

            if (error instanceof DOMException && error.name === 'AbortError') {
                if (externalSignal?.aborted) {
                    throw new FlinkSqlGatewayError('Request was cancelled')
                }
                throw new FlinkSqlGatewayError('Request timed out — Flink SQL Gateway took too long to respond')
            }

            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                throw new FlinkSqlGatewayError(
                    'Failed to connect to Flink SQL Gateway — the server may be down or unreachable'
                )
            }

            if (error instanceof Error) {
                throw new FlinkSqlGatewayError(error.message)
            }

            throw new FlinkSqlGatewayError('An unexpected error occurred')
        } finally {
            clearTimeout(timeoutId)
            if (externalSignal) {
                externalSignal.removeEventListener('abort', onExternalAbort)
            }
        }
    }

    private get<T>(path: string, signal?: AbortSignal): Promise<T> {
        return this.request<T>(path, { method: 'GET' }, DEFAULT_TIMEOUT_MS, signal)
    }

    private post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
        return this.request<T>(
            path,
            {
                method: 'POST',
                body: body !== undefined ? JSON.stringify(body) : undefined,
            },
            DEFAULT_TIMEOUT_MS,
            signal
        )
    }

    private del<T>(path: string): Promise<T> {
        return this.request<T>(path, { method: 'DELETE' })
    }

    /** Like request(), but hits the unversioned base URL (for /api_versions, /info). */
    private requestUnversioned<T>(path: string): Promise<T> {
        const base = this.baseUrl.replace(`/${API_VERSION}`, '')
        const url = `${base}${path}`
        return this.request<T>('', { method: 'GET' }, DEFAULT_TIMEOUT_MS, undefined, url)
    }

    // ── API version & info ──

    async getApiVersions(): Promise<GetApiVersionResponseBody> {
        return this.requestUnversioned<GetApiVersionResponseBody>('/api_versions')
    }

    async getInfo(): Promise<GetInfoResponseBody> {
        return this.requestUnversioned<GetInfoResponseBody>('/info')
    }

    // ── Sessions ──

    async openSession(body: OpenSessionRequestBody = {}): Promise<OpenSessionResponseBody> {
        return this.post<OpenSessionResponseBody>('/sessions', body)
    }

    async getSessionConfig(sessionHandle: string): Promise<GetSessionConfigResponseBody> {
        return this.get<GetSessionConfigResponseBody>(`/sessions/${sessionHandle}`)
    }

    async closeSession(sessionHandle: string): Promise<CloseSessionResponseBody> {
        return this.del<CloseSessionResponseBody>(`/sessions/${sessionHandle}`)
    }

    async heartbeat(sessionHandle: string): Promise<void> {
        await this.post<void>(`/sessions/${sessionHandle}/heartbeat`)
    }

    async configureSession(sessionHandle: string, body: ConfigureSessionRequestBody): Promise<void> {
        await this.post<void>(`/sessions/${sessionHandle}/configure-session`, body)
    }

    // ── Statements ──

    async executeStatement(
        sessionHandle: string,
        body: ExecuteStatementRequestBody,
        signal?: AbortSignal
    ): Promise<ExecuteStatementResponseBody> {
        return this.post<ExecuteStatementResponseBody>(`/sessions/${sessionHandle}/statements`, body, signal)
    }

    // ── Operations ──

    async getOperationStatus(sessionHandle: string, operationHandle: string): Promise<OperationStatusResponseBody> {
        return this.get<OperationStatusResponseBody>(`/sessions/${sessionHandle}/operations/${operationHandle}/status`)
    }

    async cancelOperation(sessionHandle: string, operationHandle: string): Promise<OperationStatusResponseBody> {
        return this.post<OperationStatusResponseBody>(`/sessions/${sessionHandle}/operations/${operationHandle}/cancel`)
    }

    async closeOperation(sessionHandle: string, operationHandle: string): Promise<OperationStatusResponseBody> {
        return this.del<OperationStatusResponseBody>(`/sessions/${sessionHandle}/operations/${operationHandle}/close`)
    }

    async fetchResults(
        sessionHandle: string,
        operationHandle: string,
        token: number,
        rowFormat: RowFormat = 'JSON',
        signal?: AbortSignal
    ): Promise<FetchResultsResponseBody> {
        return this.get<FetchResultsResponseBody>(
            `/sessions/${sessionHandle}/operations/${operationHandle}/result/${token}?rowFormat=${rowFormat}`,
            signal
        )
    }

    // ── Statement completion ──

    async completeStatement(
        sessionHandle: string,
        body: CompleteStatementRequestBody
    ): Promise<CompleteStatementResponseBody> {
        // Note: the OpenAPI spec says GET but sends a request body.
        // In practice Flink accepts both; we use GET with body which
        // mirrors the spec. If the gateway rejects it, switch to POST.
        return this.request<CompleteStatementResponseBody>(`/sessions/${sessionHandle}/complete-statement`, {
            method: 'GET',
            body: JSON.stringify(body),
        })
    }
}

export default FlinkSqlGatewayClient
export { FlinkSqlGatewayError, extractErrorMessage }
