import type {
  ConnectionConfig,
  ConnectionTestResult,
  InstanceMetadata,
  ServerConfigurationSummary,
  Session,
  LiveProcessSummary,
  BlockingResult,
  DeadlockResult,
  DeadlockHistoryItem,
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
  AGLagAnalysisResponse,
  Database,
  MissingIndex,
  UnusedIndex,
  IndexFragmentation,
  IndexSummary,
  TableStatistic,
  RedundantIndex,
  WaitStatsSummary,
  StorageSummary,
  OpenTransactionsSummary,
  TempDBMemorySummary,
  AgentJobsSummary,
  JobStepHistory,
  ExtendedEventsSummary,
  XETemplate,
  XESession,
  ServerProfile,
  ServerProfileCreate,
  ServerProfileListResponse,
  ServerPingResponse,
  AlertsAndMailSummary,
  IntegrityAndCorruptionSummary,
  LSNChainStatus,
  RestoreSimulationRequest,
  RestoreSimulationResult,
  VersionStoreAnalysis,
  UserProfile,
  PartitioningOverviewResponse,
  CandidateTableInfo,
  TimeTravelCorrelatorOverview,
  TimeTravelSnapshotDetail,
  ConnectionPoolSummary,
  KillSessionResponse,
  IndexRoiOverview,
  AlertRule,
  AlertRuleCreate,
  AlertEvaluationResult,
  AlertSimulationRequest,
  AlertSimulationResponse,
  FleetOverviewResponse,
  DDLAuditResponse,
  IOHeatmapResponse,
  TempDBForensicsResponse,
  AdaptiveBaselineResponse,
  QueryFingerprintResponse,
  RightSizingResponse,
  LockEscalationResponse,
  TableSchemaInspection,
  GenerateMigrationRunbookRequest,
  MigrationRunbookResponse,
  GeneratePartitionScriptRequest,
  GeneratePartitionScriptResponse,
  IncidentSimulationRequest,
  IncidentSimulationResponse,
  UserLoginRequest,
  UserRegisterRequest,
  OAuthLoginRequest,
  ProfileUpdateRequest,
  PasswordChangeRequest,
  AuthResponse,
  RolePermissionMatrixResponse,
  UpdateRolePermissionsRequest,
  UpdateUserRoleRequest,
  MemoryGrantsSummary,
  TempDBContentionSummary,
  HealthScoreResponse,
  WebhookConfig,
  WebhookTestResponse,
  TriageResponse,
  BestPracticeReport,
  MaintenancePlanSummary,
  ParsedExecutionPlan,
  RewriteQueryRequest,
  RewriteQueryResponse,
  HypotheticalSimulationRequest,
  HypotheticalSimulationResult,
  RCARequest,
  RCAReport,
  BufferPoolDrilldownResponse,
  AnomalyRadarResponse,
  CapacityRunwayResponse,
  CardinalityDriftResponse,
  RBACMatrixResponse,
  UserRoleType,
  SwitchRoleResponse,
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
      `Cannot reach the Datapath API at ${BASE_URL}. Make sure the backend is running.`
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

export async function getDeadlockHistory(limit: number = 15): Promise<DeadlockHistoryItem[]> {
  return apiFetch<DeadlockHistoryItem[]>(`/api/incidents/deadlocks/history?limit=${limit}`);
}

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

export async function getQueryRegressions(params?: {
  database?: string;
  min_exec_count?: number;
}): Promise<QueryRegression[]> {
  return apiFetch<QueryRegression[]>(
    `/api/query-store/regressions${buildQuery(params ?? {})}`
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

export async function getLSNChains(): Promise<LSNChainStatus[]> {
  return apiFetch<LSNChainStatus[]>('/api/backups/lsn-chains');
}

export async function simulatePointInTimeRestore(
  req: RestoreSimulationRequest
): Promise<RestoreSimulationResult> {
  return apiFetch<RestoreSimulationResult>('/api/backups/simulate-restore', {
    method: 'POST',
    body: JSON.stringify(req),
  });
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

export async function getAGLagTelemetry(): Promise<AGLagAnalysisResponse> {
  return apiFetch<AGLagAnalysisResponse>('/api/high-availability/lag-telemetry');
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

export async function getOpenTransactionsSummary(): Promise<OpenTransactionsSummary> {
  return apiFetch<OpenTransactionsSummary>('/api/storage/open-transactions');
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

// ── Multi-Server Profiles ─────────────────────────────────────

export async function getServerProfiles(): Promise<ServerProfileListResponse> {
  return apiFetch<ServerProfileListResponse>('/api/servers');
}

export async function getActiveServer(): Promise<ServerProfile> {
  return apiFetch<ServerProfile>('/api/servers/active');
}

export async function activateServer(serverId: string): Promise<ServerProfile> {
  return apiFetch<ServerProfile>(`/api/servers/${encodeURIComponent(serverId)}/activate`, {
    method: 'POST',
  });
}

export async function addServerProfile(data: ServerProfileCreate): Promise<ServerProfile> {
  return apiFetch<ServerProfile>('/api/servers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function pingServerProfile(serverId: string): Promise<ServerPingResponse> {
  return apiFetch<ServerPingResponse>(`/api/servers/${encodeURIComponent(serverId)}/ping`, {
    method: 'POST',
  });
}

export async function deleteServerProfile(serverId: string): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/api/servers/${encodeURIComponent(serverId)}`, {
    method: 'DELETE',
  });
}

// ── Alerts & Database Mail ───────────────────────────────────────────────────

export async function getAlertsAndMailSummary(): Promise<AlertsAndMailSummary> {
  return apiFetch<AlertsAndMailSummary>('/api/agent-jobs/alerts-and-mail');
}

// ── Database Integrity & Suspect Pages ───────────────────────────────────────

export async function getIntegritySummary(): Promise<IntegrityAndCorruptionSummary> {
  return apiFetch<IntegrityAndCorruptionSummary>('/api/backups/integrity-summary');
}

// ── Memory Grants & Semaphore ────────────────────────────────────────────────

export async function getMemoryGrantsSummary(): Promise<MemoryGrantsSummary> {
  return apiFetch<MemoryGrantsSummary>('/api/tempdb-memory/memory-grants');
}

// ── TempDB Latch Contention & Session Space ─────────────────────────────────

export async function getTempDBContentionSummary(): Promise<TempDBContentionSummary> {
  return apiFetch<TempDBContentionSummary>('/api/tempdb-memory/contention');
}

// ── Cumulative Database Health Score ─────────────────────────────────────────

export async function getHealthScore(): Promise<HealthScoreResponse> {
  return apiFetch<HealthScoreResponse>('/api/health-score');
}

// ── Crisis Notification Webhooks (Slack, Teams, Discord) ─────────────────────

export async function getWebhookConfig(): Promise<WebhookConfig> {
  return apiFetch<WebhookConfig>('/api/alerts/webhook');
}

export async function updateWebhookConfig(config: WebhookConfig): Promise<WebhookConfig> {
  return apiFetch<WebhookConfig>('/api/alerts/webhook', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function testWebhook(url: string, service_type: string): Promise<WebhookTestResponse> {
  return apiFetch<WebhookTestResponse>('/api/alerts/webhook/test', {
    method: 'POST',
    body: JSON.stringify({ url, service_type }),
  });
}

// ── 1-Click Emergency Incident Triage ───────────────────────────────────────

export async function getEmergencyTriage(): Promise<TriageResponse> {
  return apiFetch<TriageResponse>('/api/incidents/triage');
}

// ── Best Practice & Production Readiness Advisor ───────────────────────────

export async function getBestPractices(): Promise<BestPracticeReport> {
  return apiFetch<BestPracticeReport>('/api/toolkit/best-practices');
}

// ── Smart Index Maintenance & Statistics Planner ───────────────────────────

export async function getMaintenancePlan(params?: {
  database?: string;
  min_pages?: number;
  max_frag_reorg?: number;
  min_frag_rebuild?: number;
}): Promise<MaintenancePlanSummary> {
  const query = new URLSearchParams();
  if (params?.database) query.append('database', params.database);
  if (params?.min_pages !== undefined) query.append('min_pages', String(params.min_pages));
  if (params?.max_frag_reorg !== undefined) query.append('max_frag_reorg', String(params.max_frag_reorg));
  if (params?.min_frag_rebuild !== undefined) query.append('min_frag_rebuild', String(params.min_frag_rebuild));
  const qs = query.toString();
  return apiFetch<MaintenancePlanSummary>(`/api/indexes/maintenance-plan${qs ? `?${qs}` : ''}`);
}

// ── Graphical Execution Plan Viewer ─────────────────────────────────────────

export async function parseExecutionPlan(payload: {
  plan_xml?: string;
  plan_handle?: string;
}): Promise<ParsedExecutionPlan> {
  return apiFetch<ParsedExecutionPlan>('/api/query-performance/plan-parse', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Smart T-SQL Query Rewriter & Optimizer Studio ──────────────────────────

export async function rewriteQuery(payload: RewriteQueryRequest): Promise<RewriteQueryResponse> {
  return apiFetch<RewriteQueryResponse>('/api/query-performance/rewrite', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── What-If Hypothetical Index Simulator ───────────────────────────────────

export async function simulateHypotheticalIndex(
  payload: HypotheticalSimulationRequest
): Promise<HypotheticalSimulationResult> {
  return apiFetch<HypotheticalSimulationResult>('/api/indexes/simulate-hypothetical', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Incident Root-Cause Analysis (RCA) Post-Mortem ──────────────────────────

export async function generateRCAReport(payload: RCARequest): Promise<RCAReport> {
  return apiFetch<RCAReport>('/api/incidents/generate-rca', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Buffer Pool Tomography & Memory Explorer ───────────────────────────────

export async function getBufferPoolDrilldown(database?: string): Promise<BufferPoolDrilldownResponse> {
  const query = database ? `?database=${encodeURIComponent(database)}` : '';
  return apiFetch<BufferPoolDrilldownResponse>(`/api/tempdb-memory/buffer-pool-drilldown${query}`);
}



// ── Predictive Anomaly Radar ───────────────────────────────────────────────

export async function getAnomalyRadar(serverId?: string): Promise<AnomalyRadarResponse> {
  const query = serverId ? `?server_id=${encodeURIComponent(serverId)}` : '';
  return apiFetch<AnomalyRadarResponse>(`/api/anomaly-radar${query}`);
}

// ── Capacity Runway Forecasting ───────────────────────────────────────────

export async function getCapacityRunway(): Promise<CapacityRunwayResponse> {
  return apiFetch<CapacityRunwayResponse>('/api/storage/capacity-runway');
}

// ── Cardinality Drift & Parameter Sniffing ─────────────────────────────────

export async function getCardinalityDrift(): Promise<CardinalityDriftResponse> {
  return apiFetch<CardinalityDriftResponse>('/api/query-performance/cardinality-drift');
}

// ── Role-Based Access Control (RBAC) ───────────────────────────────────────

export async function getRBACMatrix(): Promise<RBACMatrixResponse> {
  return apiFetch<RBACMatrixResponse>('/api/permissions/rbac-matrix');
}

export async function switchUserRole(newRole: UserRoleType): Promise<SwitchRoleResponse> {
  return apiFetch<SwitchRoleResponse>('/api/permissions/switch-role', {
    method: 'POST',
    body: JSON.stringify({ new_role: newRole }),
  });
}


// ── Version Store & Snapshot Isolation Leak Radar ───────────
export async function getVersionStoreAnalysis(): Promise<VersionStoreAnalysis> {
  return apiFetch<VersionStoreAnalysis>('/api/tempdb-memory/version-store');
}


// ── Authentication, OAuth & Profile Management ───────────────

export async function loginUser(req: UserLoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function registerUser(req: UserRegisterRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function oauthLoginUser(req: OAuthLoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/oauth', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getCurrentUser(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/auth/me');
}

export async function updateUserProfile(req: ProfileUpdateRequest): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(req),
  });
}

export async function changeUserPassword(req: PasswordChangeRequest): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function logoutUser(): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>('/api/auth/logout', {
    method: 'POST',
  });
}


// ── Role & Permission Policy Management ───────────────────────
export async function getPermissionsMatrix(): Promise<RolePermissionMatrixResponse> {
  return apiFetch<RolePermissionMatrixResponse>('/api/auth/permissions-matrix');
}

export async function updateRolePermissions(req: UpdateRolePermissionsRequest): Promise<RolePermissionMatrixResponse> {
  return apiFetch<RolePermissionMatrixResponse>('/api/auth/role-permissions', {
    method: 'PUT',
    body: JSON.stringify(req),
  });
}

export async function getAllUsers(): Promise<UserProfile[]> {
  return apiFetch<UserProfile[]>('/api/auth/users');
}

export async function updateUserRole(req: UpdateUserRoleRequest): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/auth/users/role', {
    method: 'PUT',
    body: JSON.stringify(req),
  });
}

export async function resetPermissionsToDefault(): Promise<RolePermissionMatrixResponse> {
  return apiFetch<RolePermissionMatrixResponse>('/api/auth/reset-permissions', {
    method: 'POST',
  });
}

export async function elevateToAdmin(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/auth/elevate-admin', {
    method: 'POST',
  });
}

export async function simulateLock(req: IncidentSimulationRequest): Promise<IncidentSimulationResponse> {
  return apiFetch<IncidentSimulationResponse>('/api/incidents/simulate-lock', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}


// ── Table Partitioning & Sliding Window Lifecycle ─────────────────────────
export async function getPartitioningOverview(database?: string): Promise<PartitioningOverviewResponse> {
  const query = database ? '?database=' + encodeURIComponent(database) : '';
  return apiFetch<PartitioningOverviewResponse>('/api/partitioning/overview' + query);
}

export async function generatePartitionScript(
  req: GeneratePartitionScriptRequest
): Promise<GeneratePartitionScriptResponse> {
  return apiFetch<GeneratePartitionScriptResponse>('/api/partitioning/generate-script', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}


// ── Zero-Downtime Online Schema Migration Studio ──────────────────────────
export async function getMigrationCandidateTables(database?: string): Promise<CandidateTableInfo[]> {
  const query = database ? '?database=' + encodeURIComponent(database) : '';
  return apiFetch<CandidateTableInfo[]>('/api/online-migrations/tables' + query);
}

export async function getTableSchemaDetails(
  table: string,
  schema: string = 'dbo',
  database?: string
): Promise<TableSchemaInspection> {
  const query = '?table=' + encodeURIComponent(table) + '&schema=' + encodeURIComponent(schema) + (database ? '&database=' + encodeURIComponent(database) : '');
  return apiFetch<TableSchemaInspection>('/api/online-migrations/table-details' + query);
}

export async function generateMigrationRunbook(
  req: GenerateMigrationRunbookRequest
): Promise<MigrationRunbookResponse> {
  return apiFetch<MigrationRunbookResponse>('/api/online-migrations/generate-runbook', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}


// ── Workload Time-Travel Correlator & Spike Detective ─────────────────────
export async function getTimeTravelOverview(
  database?: string,
  timeRange: string = '24H'
): Promise<TimeTravelCorrelatorOverview> {
  const query = '?time_range=' + encodeURIComponent(timeRange) + (database ? '&database=' + encodeURIComponent(database) : '');
  return apiFetch<TimeTravelCorrelatorOverview>('/api/time-travel/overview' + query);
}

export async function getTimeTravelSnapshot(
  intervalId: number,
  database?: string
): Promise<TimeTravelSnapshotDetail> {
  const query = '?interval_id=' + encodeURIComponent(String(intervalId)) + (database ? '&database=' + encodeURIComponent(database) : '');
  return apiFetch<TimeTravelSnapshotDetail>('/api/time-travel/snapshot' + query);
}

// ── Connection Sentinel & Session Leak Hunter ─────────────────────────
export async function getConnectionPoolSummary(
  database?: string
): Promise<ConnectionPoolSummary> {
  const query = database ? '?database=' + encodeURIComponent(database) : '';
  return apiFetch<ConnectionPoolSummary>('/api/connection-sentinel/summary' + query);
}

export async function getKillSessionScript(
  sessionId: number
): Promise<KillSessionResponse> {
  return apiFetch<KillSessionResponse>('/api/connection-sentinel/kill-script/' + encodeURIComponent(String(sessionId)));
}

// ── Index ROI & Write Penalty Optimizer ───────────────────────────
export async function getIndexRoiOverview(
  database?: string
): Promise<IndexRoiOverview> {
  const query = database ? '?database=' + encodeURIComponent(database) : '';
  return apiFetch<IndexRoiOverview>('/api/index-roi/overview' + query);
}


// ── Custom Alert Rules & Threshold Engine ────────────────────────────────
export async function getAlertRules(): Promise<AlertRule[]> {
  return apiFetch<AlertRule[]>('/api/alerts/rules');
}

export async function createAlertRule(rule: AlertRuleCreate): Promise<AlertRule> {
  return apiFetch<AlertRule>('/api/alerts/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
}

export async function updateAlertRule(ruleId: string, rule: AlertRuleCreate): Promise<AlertRule> {
  return apiFetch<AlertRule>(`/api/alerts/rules/${encodeURIComponent(ruleId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
}

export async function deleteAlertRule(ruleId: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/alerts/rules/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
  });
}

export async function toggleAlertRule(ruleId: string, isEnabled: boolean): Promise<AlertRule> {
  return apiFetch<AlertRule>(`/api/alerts/rules/${encodeURIComponent(ruleId)}/toggle?is_enabled=${isEnabled}`, {
    method: 'PATCH',
  });
}

export async function evaluateAlertRules(triggerWebhooks: boolean = false): Promise<AlertEvaluationResult> {
  return apiFetch<AlertEvaluationResult>(`/api/alerts/rules/evaluate?trigger_webhooks=${triggerWebhooks}`, {
    method: 'POST',
  });
}

export async function simulateAlert(payload: AlertSimulationRequest): Promise<AlertSimulationResponse> {
  return apiFetch<AlertSimulationResponse>('/api/alerts/rules/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}


// ── Multi-Server Fleet Overview & Estate Intelligence ────────────────────
export async function getFleetOverview(): Promise<FleetOverviewResponse> {
  return apiFetch<FleetOverviewResponse>('/api/fleet/overview');
}


// ── DDL Audit & Schema Change Timeline ───────────────────────────────────
export async function getDDLAuditEvents(
  database?: string,
  actionType?: string,
  limit: number = 100
): Promise<DDLAuditResponse> {
  const params = new URLSearchParams();
  if (database) params.append('database', database);
  if (actionType) params.append('action_type', actionType);
  if (limit) params.append('limit', String(limit));
  const query = params.toString() ? '?' + params.toString() : '';
  return apiFetch<DDLAuditResponse>('/api/ddl-audit/events' + query);
}


// ── File IO Latency & Stall Heatmap Studio ──────────────────────────────
export async function getFileIoHeatmap(): Promise<IOHeatmapResponse> {
  return apiFetch<IOHeatmapResponse>('/api/storage/io-heatmap');
}


// ── TempDB Space Hog & Spill Forensic Investigator ──────────────────────
export async function getTempDBForensics(): Promise<TempDBForensicsResponse> {
  return apiFetch<TempDBForensicsResponse>('/api/tempdb/forensics');
}


// ── Adaptive Query Performance Baselines & Regressions ──────────────────
export async function getAdaptiveBaselines(
  database?: string,
  severity?: string,
  windowHours: number = 24
): Promise<AdaptiveBaselineResponse> {
  const params = new URLSearchParams();
  if (database) params.append('database', database);
  if (severity && severity !== 'ALL') params.append('severity', severity);
  if (windowHours) params.append('window_hours', String(windowHours));
  const q = params.toString() ? '?' + params.toString() : '';
  return apiFetch<AdaptiveBaselineResponse>('/api/query-performance/adaptive-baselines' + q);
}


// ── Query Fingerprints & Canonical Signatures ────────────────────────────
export async function getQueryFingerprints(
  metric: string = 'duration',
  limit: number = 50,
  search?: string
): Promise<QueryFingerprintResponse> {
  const params = new URLSearchParams();
  if (metric) params.append('metric', metric);
  if (limit) params.append('limit', String(limit));
  if (search) params.append('search', search);
  const q = params.toString() ? '?' + params.toString() : '';
  return apiFetch<QueryFingerprintResponse>('/api/query-performance/fingerprints' + q);
}


// ── Resource Right-Sizing & Cost Optimization Advisor ───────────────────
export async function getRightSizingAdvisor(): Promise<RightSizingResponse> {
  return apiFetch<RightSizingResponse>('/api/instances/right-sizing');
}


// ── Lock Escalation & Contention Heatmap ──────────────────────────────
export async function getLockEscalationAnalysis(database?: string): Promise<LockEscalationResponse> {
  const params = new URLSearchParams();
  if (database) params.append('database', database);
  const q = params.toString() ? '?' + params.toString() : '';
  return apiFetch<LockEscalationResponse>('/api/incidents/lock-escalation' + q);
}
