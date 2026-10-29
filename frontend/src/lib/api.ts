import type {
  ConnectionConfig,
  ConnectionTestResult,
  InstanceMetadata,
  ServerConfigurationSummary,
  Session,
  LiveProcessSummary,
  BlockingResult,
  DeadlockResult,
  AgentJobResult,
  ErrorLogEntry,
  TimelineEvent,
  QueryStoreOverview,
  ExpensiveQuery,
  QueryRegression,
  PlanAntiPatternsSummary,
  BackupEntry,
  DatabaseIntegrityCheck,
  RecoveryReadiness,
  SchemaDiffConfig,
  SchemaDiffResult,
  Script,
  Login,
  DbUser,
  Role,
  SecurityAuditSummary,
  HAStatus,
  Database,
  MissingIndex,
  UnusedIndex,
  IndexFragmentation,
  IndexSummary,
  TableStatistic,
  RedundantIndex,
  WaitStatsSummary,
  StorageSummary,
  TempDBMemorySummary,
  AgentJobsSummary,
  JobStepHistory,
  ExtendedEventsSummary,
  XETemplate,
  XESession,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Core fetch helper ─────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch (err) {
    throw new Error(
      `Cannot reach the Traceforge API at ${BASE_URL}. Make sure the backend is running.`
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  // Return empty object for 204 / no-content
  return {} as T;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

// ── Connection ────────────────────────────────────────────────

export async function testConnection(
  config: ConnectionConfig
): Promise<ConnectionTestResult> {
  return apiFetch<ConnectionTestResult>('/api/connection/test', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

// ── Instance ──────────────────────────────────────────────────

export async function getInstanceMetadata(): Promise<InstanceMetadata> {
  return apiFetch<InstanceMetadata>('/api/instance/metadata');
}

export async function getDatabases(): Promise<Database[]> {
  return apiFetch<Database[]>('/api/instance/databases');
}

export async function getServerConfigurations(): Promise<ServerConfigurationSummary> {
  return apiFetch<ServerConfigurationSummary>('/api/instance/configurations');
}

// ── Sessions ──────────────────────────────────────────────────

export async function getSessions(params?: {
  active_only?: boolean;
  include_system?: boolean;
}): Promise<Session[]> {
  return apiFetch<Session[]>(`/api/sessions${buildQuery(params ?? {})}`);
}

export async function getLiveSessionsSummary(params?: {
  active_only?: boolean;
  min_duration_ms?: number;
}): Promise<LiveProcessSummary> {
  return apiFetch<LiveProcessSummary>(
    `/api/sessions/live${buildQuery(params ?? {})}`
  );
}

// ── Blocking ──────────────────────────────────────────────────

export async function getBlocking(): Promise<BlockingResult> {
  return apiFetch<BlockingResult>('/api/blocking');
}

// ── Deadlocks ─────────────────────────────────────────────────

export async function parseDeadlock(xmlContent: string): Promise<DeadlockResult> {
  return apiFetch<DeadlockResult>('/api/deadlocks/parse', {
    method: 'POST',
    body: JSON.stringify({ xml_content: xmlContent }),
  });
}

// ── Agent Jobs ────────────────────────────────────────────────

export async function getAgentJobs(params?: {
  days_back?: number;
  failed_only?: boolean;
}): Promise<AgentJobResult> {
  return apiFetch<AgentJobResult>(`/api/agent-jobs${buildQuery(params ?? {})}`);
}

// ── Error Log ─────────────────────────────────────────────────

export async function getErrorLog(params?: {
  search?: string;
  log_number?: number;
  rows?: number;
}): Promise<ErrorLogEntry[]> {
  return apiFetch<ErrorLogEntry[]>(`/api/error-log${buildQuery(params ?? {})}`);
}

// ── Timeline ──────────────────────────────────────────────────

export async function getIncidentTimeline(
  hoursBack = 24
): Promise<TimelineEvent[]> {
  return apiFetch<TimelineEvent[]>(
    `/api/incident-timeline${buildQuery({ hours_back: hoursBack })}`
  );
}

// ── Query Store ───────────────────────────────────────────────

export async function getQueryStoreOverview(
  database?: string
): Promise<QueryStoreOverview> {
  return apiFetch<QueryStoreOverview>(
    `/api/query-store/overview${buildQuery({ database })}`
  );
}

export async function getExpensiveQueries(params: {
  database: string;
  metric?: string;
  top_n?: number;
}): Promise<ExpensiveQuery[]> {
  return apiFetch<ExpensiveQuery[]>(
    `/api/query-store/expensive${buildQuery(params)}`
  );
}

export async function getQueryRegressions(params: {
  database: string;
  min_exec_count?: number;
}): Promise<QueryRegression[]> {
  return apiFetch<QueryRegression[]>(
    `/api/query-store/regressions${buildQuery(params)}`
  );
}

export async function getPlanAntiPatterns(): Promise<PlanAntiPatternsSummary> {
  return apiFetch<PlanAntiPatternsSummary>('/api/query-performance/plan-anti-patterns');
}

// ── Backups ───────────────────────────────────────────────────

export async function getBackupHistory(params?: {
  database?: string;
  days_back?: number;
  backup_type?: string;
}): Promise<BackupEntry[]> {
  return apiFetch<BackupEntry[]>(`/api/backups/history${buildQuery(params ?? {})}`);
}

export async function getRecoveryReadiness(): Promise<RecoveryReadiness[]> {
  return apiFetch<RecoveryReadiness[]>('/api/backups/recovery-readiness');
}

export async function getDatabaseIntegrityChecks(): Promise<DatabaseIntegrityCheck[]> {
  return apiFetch<DatabaseIntegrityCheck[]>('/api/backups/integrity');
}

// ── Schema Diff ───────────────────────────────────────────────

export async function compareSchemas(
  config: SchemaDiffConfig
): Promise<SchemaDiffResult> {
  return apiFetch<SchemaDiffResult>('/api/schema-diff/compare', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

// ── Toolkit ───────────────────────────────────────────────────

export async function getToolkitScripts(params?: {
  category?: string;
  search?: string;
}): Promise<Script[]> {
  return apiFetch<Script[]>(`/api/toolkit/scripts${buildQuery(params ?? {})}`);
}

export async function getToolkitCategories(): Promise<string[]> {
  return apiFetch<string[]>('/api/toolkit/categories');
}

// ── Permissions ───────────────────────────────────────────────

export async function getLogins(): Promise<Login[]> {
  return apiFetch<Login[]>('/api/permissions/logins');
}

export async function getDatabaseUsers(dbName: string): Promise<DbUser[]> {
  return apiFetch<DbUser[]>(
    `/api/permissions/users${buildQuery({ database: dbName })}`
  );
}

export async function getRoles(): Promise<Role[]> {
  return apiFetch<Role[]>('/api/permissions/roles');
}

export async function getSecurityAudit(): Promise<SecurityAuditSummary> {
  return apiFetch<SecurityAuditSummary>('/api/permissions/audit');
}

// ── High Availability ─────────────────────────────────────────

export async function getHAStatus(): Promise<HAStatus> {
  return apiFetch<HAStatus>('/api/high-availability/status');
}

// ── Index Intelligence ────────────────────────────────────────

export async function getIndexSummary(database?: string): Promise<IndexSummary> {
  return apiFetch<IndexSummary>(
    `/api/indexes/summary${buildQuery({ database: database ?? '' })}`
  );
}

export async function getMissingIndexes(database?: string): Promise<MissingIndex[]> {
  return apiFetch<MissingIndex[]>(
    `/api/indexes/missing${buildQuery({ database: database ?? '' })}`
  );
}

export async function getUnusedIndexes(database?: string): Promise<UnusedIndex[]> {
  return apiFetch<UnusedIndex[]>(
    `/api/indexes/unused${buildQuery({ database: database ?? '' })}`
  );
}

export async function getIndexFragmentation(
  database?: string
): Promise<IndexFragmentation[]> {
  return apiFetch<IndexFragmentation[]>(
    `/api/indexes/fragmentation${buildQuery({ database: database ?? '' })}`
  );
}

export async function getTableStatistics(
  database?: string
): Promise<TableStatistic[]> {
  return apiFetch<TableStatistic[]>(
    `/api/indexes/statistics${buildQuery({ database: database ?? '' })}`
  );
}

export async function getRedundantIndexes(
  database?: string
): Promise<RedundantIndex[]> {
  return apiFetch<RedundantIndex[]>(
    `/api/indexes/redundant${buildQuery({ database: database ?? '' })}`
  );
}

// ── Wait Statistics ───────────────────────────────────────────

export async function getWaitStatistics(): Promise<WaitStatsSummary> {
  return apiFetch<WaitStatsSummary>('/api/waits');
}

// ── Storage & Autogrowth ──────────────────────────────────────

export async function getStorageSummary(): Promise<StorageSummary> {
  return apiFetch<StorageSummary>('/api/storage');
}

// ── TempDB & Memory Intelligence ──────────────────────────────

export async function getTempDBMemorySummary(): Promise<TempDBMemorySummary> {
  return apiFetch<TempDBMemorySummary>('/api/tempdb-memory');
}

// ── SQL Server Agent Jobs ─────────────────────────────────────

export async function getAgentJobsSummary(): Promise<AgentJobsSummary> {
  return apiFetch<AgentJobsSummary>('/api/agent-jobs/summary');
}

export async function getJobStepHistory(jobId: string): Promise<JobStepHistory[]> {
  return apiFetch<JobStepHistory[]>(`/api/agent-jobs/${jobId}/history`);
}

// ── Extended Events (XE) ──────────────────────────────────────

export async function getExtendedEventsSummary(): Promise<ExtendedEventsSummary> {
  return apiFetch<ExtendedEventsSummary>('/api/extended-events');
}

export async function getXETemplates(): Promise<XETemplate[]> {
  return apiFetch<XETemplate[]>('/api/extended-events/templates');
}





