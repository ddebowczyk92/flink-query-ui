import { FlinkSqlGatewayError } from '../api/FlinkSqlGatewayClient'

/**
 * Extract a human-readable message from an unknown caught value.
 * Replaces the scattered `error instanceof Error ? error.message : '...'` pattern.
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === 'string') {
        return error
    }
    return String(error)
}

/**
 * Check whether an error represents a user-initiated abort (cancellation).
 */
export function isAbortError(error: unknown): boolean {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return true
    }
    if (error instanceof FlinkSqlGatewayError && error.message === 'Request was cancelled') {
        return true
    }
    return false
}

/**
 * Check whether an error indicates the Flink SQL Gateway session has expired.
 */
export function isSessionExpired(error: unknown): boolean {
    if (error instanceof FlinkSqlGatewayError) {
        return error.sessionExpired
    }
    return false
}

/**
 * Parse a human-readable root-cause message from a Flink Java stack trace.
 * Finds the deepest "Caused by:" line and strips the Java class name prefix.
 */
export function extractErrorMessage(rawError: string): string {
    // Strip Flink's wrapper markers
    const cleaned = rawError.replace(/<Exception on server side:\n?/g, '').replace(/\n?>$/g, '')
    const lines = cleaned.split('\n')

    // Find the last "Caused by:" line — that's the deepest root cause
    let lastCausedBy = ''
    for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('Caused by:')) {
            lastCausedBy = trimmed
        }
    }

    if (lastCausedBy) {
        const afterCausedBy = lastCausedBy.replace(/^Caused by:\s*/, '')
        const message = extractAfterClassName(afterCausedBy)
        if (message) return message
        return afterCausedBy
    }

    // No "Caused by:" — try the first exception line
    for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('at ')) {
            const message = extractAfterClassName(trimmed)
            if (message) return message
            return trimmed
        }
    }

    return rawError
}

/**
 * Strip a Java fully-qualified exception class name prefix from an error string.
 * e.g. "org.apache.flink.SomeException: Actual message" → "Actual message"
 */
export function extractAfterClassName(text: string): string | null {
    const match = text.match(/^[\w.]+Exception:\s*(.+)$/)
    if (match && match[1]) return match[1]
    const match2 = text.match(/^[\w.]+Error:\s*(.+)$/)
    if (match2 && match2[1]) return match2[1]
    return null
}

/**
 * Parse the next result-page token from a Flink SQL Gateway `nextResultUri`.
 * Shared between FlinkQueryRunner and SchemaProvider.
 */
export function parseNextToken(nextResultUri: string, currentToken: number): number {
    if (!nextResultUri) return currentToken + 1
    const match = nextResultUri.match(/\/result\/(\d+)/)
    if (match) return parseInt(match[1], 10)
    return currentToken + 1
}
