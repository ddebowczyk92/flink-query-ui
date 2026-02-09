import FlinkSqlGatewayClient from '../api/FlinkSqlGatewayClient'
import { ColumnInfo, FetchResultsResponseBody, RowData } from '../api/FlinkSqlGatewayTypes'
import { getErrorMessage, isSessionExpired, parseNextToken } from '../utils/Errors'

export type QueryState = 'IDLE' | 'SUBMITTING' | 'RUNNING' | 'FINISHED' | 'FAILED' | 'CANCELLING' | 'CANCELLED'

export interface QueryRunnerCallbacks {
    onStateChange: (state: QueryState) => void
    onColumnsReceived: (columns: ColumnInfo[]) => void
    onRowsReceived: (rows: RowData[], totalRowCount: number) => void
    onError: (message: string) => void
    onWarning?: (message: string) => void
    onJobId: (jobId: string) => void
    onIsQueryResult: (isQuery: boolean) => void
    onSessionExpired?: () => void
    onStatementProgress?: (current: number, total: number) => void
}

const MAX_ROWS = 10_000
const POLL_BACKOFF_STEP_MS = 100
const POLL_BACKOFF_MAX_MS = 2_000

/**
 * Orchestrates the full lifecycle of a single Flink SQL statement execution:
 *   1. Submit statement via executeStatement
 *   2. Immediately start fetching result pages (handles both batch and streaming)
 *   3. Accumulate rows, streaming them to the UI as they arrive
 *   4. Stop on EOS (batch) or when cancelled / MAX_ROWS reached (streaming)
 */
class FlinkQueryRunner {
    private client: FlinkSqlGatewayClient
    private sessionHandle: string
    private callbacks: QueryRunnerCallbacks

    private operationHandle: string | null = null
    private jobId: string | null = null
    private state: QueryState = 'IDLE'
    private allRows: RowData[] = []
    private columns: ColumnInfo[] = []
    private cancelRequested = false
    private submitAbortController: AbortController | null = null
    private fetchAbortController: AbortController | null = null
    private isQueryResultReported = false
    private multiStatementIndex = 0
    private multiStatementTotal = 0

    constructor(client: FlinkSqlGatewayClient, sessionHandle: string, callbacks: QueryRunnerCallbacks) {
        this.client = client
        this.sessionHandle = sessionHandle
        this.callbacks = callbacks
    }

    getState(): QueryState {
        return this.state
    }

    isRunning(): boolean {
        return this.state === 'SUBMITTING' || this.state === 'RUNNING' || this.state === 'CANCELLING'
    }

    async execute(statement: string, executionConfig?: Record<string, string>): Promise<void> {
        if (this.isRunning()) {
            return
        }

        this.reset()
        this.setState('SUBMITTING')

        try {
            this.submitAbortController = new AbortController()
            const response = await this.client.executeStatement(
                this.sessionHandle,
                { statement, executionConfig },
                this.submitAbortController.signal
            )
            this.submitAbortController = null
            this.operationHandle = response.operationHandle

            if (this.cancelRequested) {
                await this.performCancel()
                return
            }

            this.setState('RUNNING')
            await this.fetchResults()
        } catch (error) {
            if (this.cancelRequested) {
                this.setState('CANCELLED')
                return
            }
            this.handleError(error)
        }
    }

    async executeAll(statements: string[], executionConfig?: Record<string, string>): Promise<void> {
        if (this.isRunning() || statements.length === 0) {
            return
        }

        // Single statement — use the simple path
        if (statements.length === 1) {
            return this.execute(statements[0], executionConfig)
        }

        this.reset()
        this.multiStatementTotal = statements.length

        for (let i = 0; i < statements.length; i++) {
            if (this.cancelRequested) {
                this.setState('CANCELLED')
                return
            }

            this.multiStatementIndex = i
            this.callbacks.onStatementProgress?.(i + 1, statements.length)

            // Reset per-statement state but keep multi-statement tracking
            this.operationHandle = null
            this.jobId = null
            this.allRows = []
            this.columns = []
            this.submitAbortController = null
            this.fetchAbortController = null
            this.isQueryResultReported = false

            // Clear previous results for intermediate statements
            this.callbacks.onColumnsReceived([])
            this.callbacks.onRowsReceived([], 0)
            this.callbacks.onJobId('')
            this.callbacks.onIsQueryResult(true)

            this.setState('SUBMITTING')

            try {
                this.submitAbortController = new AbortController()
                const response = await this.client.executeStatement(
                    this.sessionHandle,
                    { statement: statements[i], executionConfig },
                    this.submitAbortController.signal
                )
                this.submitAbortController = null
                this.operationHandle = response.operationHandle

                if (this.cancelRequested) {
                    await this.performCancel()
                    return
                }

                this.setState('RUNNING')
                await this.fetchResults()

                // If the statement failed or was cancelled, stop the sequence
                if (this.state === 'FAILED' || this.state === 'CANCELLED') {
                    return
                }
            } catch (error) {
                if (this.cancelRequested) {
                    this.setState('CANCELLED')
                    return
                }
                // Annotate the error with which statement failed
                if (isSessionExpired(error) && this.callbacks.onSessionExpired) {
                    this.state = 'IDLE'
                    this.callbacks.onSessionExpired()
                    return
                }
                const message = getErrorMessage(error)
                this.callbacks.onError(`Statement ${i + 1}/${statements.length}: ${message}`)
                console.error('FlinkQueryRunner error:', message)
                this.setState('FAILED')
                return
            }
        }

        // All statements completed — final state should already be FINISHED from the last fetchResults
        this.multiStatementIndex = statements.length - 1
        this.callbacks.onStatementProgress?.(statements.length, statements.length)
    }

    async cancel(): Promise<void> {
        if (!this.isRunning()) {
            return
        }

        this.cancelRequested = true

        // Abort any in-flight HTTP request (submission or fetch)
        if (this.submitAbortController) {
            this.submitAbortController.abort()
        }
        if (this.fetchAbortController) {
            this.fetchAbortController.abort()
        }

        if (this.operationHandle) {
            await this.performCancel()
        }
    }

    private async performCancel(): Promise<void> {
        if (!this.operationHandle) return

        this.setState('CANCELLING')
        try {
            await this.client.cancelOperation(this.sessionHandle, this.operationHandle)
        } catch {
            // Cancel can fail if the operation already finished — that's fine
        }

        // Stop the underlying Flink job so it doesn't keep consuming resources
        if (this.jobId) {
            try {
                await this.client.executeStatement(this.sessionHandle, {
                    statement: `STOP JOB '${this.jobId}'`,
                })
            } catch {
                // Job may have already finished or been cancelled
            }
        }

        try {
            await this.client.closeOperation(this.sessionHandle, this.operationHandle)
        } catch {
            // Close can fail if already closed
        }
        this.setState('CANCELLED')
    }

    private async fetchResults(): Promise<void> {
        if (!this.operationHandle) return

        this.fetchAbortController = new AbortController()
        const signal = this.fetchAbortController.signal
        let token = 0
        let backoffMs = 0

        while (true) {
            if (this.cancelRequested) {
                await this.performCancel()
                return
            }

            let result: FetchResultsResponseBody
            try {
                result = await this.client.fetchResults(this.sessionHandle, this.operationHandle, token, 'JSON', signal)
            } catch (error) {
                // If we were cancelled, the abort is expected — don't treat it as an error
                if (this.cancelRequested) {
                    return
                }
                if (this.allRows.length > 0) {
                    this.handleErrorMessage(error)
                    this.setState('FINISHED')
                } else {
                    this.handleError(error)
                }
                return
            }

            // Guard against missing results (shouldn't happen after error handling in client, but be safe)
            if (!result.results) {
                backoffMs = Math.min(backoffMs + POLL_BACKOFF_STEP_MS, POLL_BACKOFF_MAX_MS)
                await this.sleep(backoffMs)
                continue
            }

            // Extract columns from the first page that has them
            if (result.results.columns && result.results.columns.length > 0 && this.columns.length === 0) {
                this.columns = result.results.columns
                this.callbacks.onColumnsReceived(this.columns)
            }

            if (result.jobID) {
                this.jobId = result.jobID
                this.callbacks.onJobId(result.jobID)
            }

            if (!this.isQueryResultReported && result.resultType === 'PAYLOAD') {
                this.isQueryResultReported = true
                this.callbacks.onIsQueryResult(result.isQueryResult)
            }

            if (result.resultType === 'NOT_READY') {
                backoffMs = Math.min(backoffMs + POLL_BACKOFF_STEP_MS, POLL_BACKOFF_MAX_MS)
                await this.sleep(backoffMs)
                continue
            }

            // PAYLOAD — accumulate rows
            if (result.resultType === 'PAYLOAD' && result.results.data) {
                const newRows = result.results.data
                const spaceLeft = MAX_ROWS - this.allRows.length

                if (newRows.length > spaceLeft) {
                    this.allRows.push(...newRows.slice(0, spaceLeft))
                    this.callbacks.onRowsReceived(this.allRows, this.allRows.length)
                    const msg = `Results trimmed to ${MAX_ROWS.toLocaleString()} rows`
                    if (this.callbacks.onWarning) {
                        this.callbacks.onWarning(msg)
                    } else {
                        this.callbacks.onError(msg)
                    }
                    await this.performCancel()
                    this.setState('FINISHED')
                    return
                }

                this.allRows.push(...newRows)
                this.callbacks.onRowsReceived(this.allRows, this.allRows.length)
                backoffMs = 0
            }

            // EOS — done
            if (result.resultType === 'EOS') {
                this.setState('FINISHED')
                return
            }

            // Next page
            token = parseNextToken(result.nextResultUri, token)
        }
    }

    private handleError(error: unknown): void {
        if (isSessionExpired(error) && this.callbacks.onSessionExpired) {
            this.state = 'IDLE'
            this.callbacks.onSessionExpired()
            return
        }
        this.handleErrorMessage(error)
        this.setState('FAILED')
    }

    private handleErrorMessage(error: unknown): void {
        let message = getErrorMessage(error)
        if (this.multiStatementTotal > 1) {
            message = `Statement ${this.multiStatementIndex + 1}/${this.multiStatementTotal}: ${message}`
        }
        console.error('FlinkQueryRunner error:', message)
        this.callbacks.onError(message)
    }

    private setState(state: QueryState): void {
        this.state = state
        this.callbacks.onStateChange(state)
    }

    private reset(): void {
        this.operationHandle = null
        this.jobId = null
        this.allRows = []
        this.columns = []
        this.cancelRequested = false
        this.submitAbortController = null
        this.fetchAbortController = null
        this.isQueryResultReported = false
        this.multiStatementIndex = 0
        this.multiStatementTotal = 0
        this.state = 'IDLE'
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}

export default FlinkQueryRunner
