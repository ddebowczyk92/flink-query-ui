// Types derived from the Flink SQL Gateway REST API v4 OpenAPI spec.
// https://nightlies.apache.org/flink/flink-docs-release-2.2/generated/rest_v4_sql_gateway.yml

// ── API info ──

export interface GetApiVersionResponseBody {
    versions: string[]
}

export interface GetInfoResponseBody {
    productName: string
    version: string
}

// ── Sessions ──

export interface OpenSessionRequestBody {
    sessionName?: string
    properties?: Record<string, string>
}

export interface OpenSessionResponseBody {
    sessionHandle: string
}

export interface GetSessionConfigResponseBody {
    properties: Record<string, string>
}

export interface CloseSessionResponseBody {
    status: string
}

// ── Configure session ──

export interface ConfigureSessionRequestBody {
    statement: string
    executionTimeout?: number
}

// ── Statements ──

export interface ExecuteStatementRequestBody {
    statement: string
    executionTimeout?: number
    executionConfig?: Record<string, string>
}

export interface ExecuteStatementResponseBody {
    operationHandle: string
}

// ── Operations ──

export type OperationStatus =
    | 'INITIALIZED'
    | 'PENDING'
    | 'RUNNING'
    | 'FINISHED'
    | 'CANCELED'
    | 'TIMEOUT'
    | 'ERROR'
    | 'CLOSED'

export interface OperationStatusResponseBody {
    status: OperationStatus
}

// ── Results ──

export type RowFormat = 'JSON' | 'PLAIN_TEXT'

export type ResultKind = 'SUCCESS' | 'SUCCESS_WITH_CONTENT'

export type ResultType = 'NOT_READY' | 'PAYLOAD' | 'EOS'

export type RowKind = 'INSERT' | 'UPDATE_BEFORE' | 'UPDATE_AFTER' | 'DELETE'

export type LogicalTypeRoot =
    | 'CHAR'
    | 'VARCHAR'
    | 'BOOLEAN'
    | 'BINARY'
    | 'VARBINARY'
    | 'DECIMAL'
    | 'TINYINT'
    | 'SMALLINT'
    | 'INTEGER'
    | 'BIGINT'
    | 'FLOAT'
    | 'DOUBLE'
    | 'DATE'
    | 'TIME_WITHOUT_TIME_ZONE'
    | 'TIMESTAMP_WITHOUT_TIME_ZONE'
    | 'TIMESTAMP_WITH_TIME_ZONE'
    | 'TIMESTAMP_WITH_LOCAL_TIME_ZONE'
    | 'INTERVAL_YEAR_MONTH'
    | 'INTERVAL_DAY_TIME'
    | 'ARRAY'
    | 'MULTISET'
    | 'MAP'
    | 'ROW'
    | 'DISTINCT_TYPE'
    | 'STRUCTURED_TYPE'
    | 'NULL'
    | 'RAW'
    | 'SYMBOL'
    | 'UNRESOLVED'

export interface LogicalType {
    type: LogicalTypeRoot
    nullable: boolean
    length?: number
    precision?: number
    scale?: number
    children?: LogicalType[]
}

export interface ColumnInfo {
    name: string
    logicalType: LogicalType
    comment?: string
}

export interface RowData {
    kind: RowKind
    fields: any[]
}

export interface ResultInfo {
    columns: ColumnInfo[]
    data: RowData[]
    rowFormat: RowFormat
}

export interface FetchResultsResponseBody {
    resultType: ResultType
    resultKind: ResultKind
    results: ResultInfo
    nextResultUri: string
    jobID?: string
    isQueryResult: boolean
}

// ── Statement completion ──

export interface CompleteStatementRequestBody {
    statement: string
    position: number
}

export interface CompleteStatementResponseBody {
    candidates: string[]
}

// ── Deploy script ──

export interface DeployScriptRequestBody {
    script?: string
    scriptUri?: string
    executionConfig?: Record<string, string>
}

export interface DeployScriptResponseBody {
    clusterID: string
}
