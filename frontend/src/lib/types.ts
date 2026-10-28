/* ============================================
   All TypeScript types matching backend schemas
   ============================================ */

// ── Connection ────────────────────────────────────────────────
export interface ConnectionConfig {
  server: string;
  database: string;
  username?: string;
  password?: string;
  trusted_connection?: boolean;
  use_windows_auth?: boolean;
  driver?: string;
  port?: number;
  timeout?: number;
}

export interface ServerInfo {
  version?: string;
  edition?: string;
  product_level?: string;
  product_version?: string;
  server_name?: string;
  collation?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  server_info?: ServerInfo | null;
  server_version?: string;
  server_edition?: string;
  connection_string_used?: string;
}

// ── Instance Metadata ─────────────────────────────────────────
export interface DatabaseInfo {
  name: string;
  state?: string;
  recovery_model?: string;
  size_mb?: number | null;
  log_size_mb?: number | null;
  compatibility_level?: number | null;
  is_read_only?: boolean | null;
  create_date?: string | null;
  [key: string]: any;
}

export interface InstanceMetadata {
  server_name?: string;
  version?: string;
  edition?: string;
  product_level?: string;
  product_version?: string;
  collation?: string;
  cpu_count?: number;
  memory_gb?: number | null;
  max_memory_gb?: number | null;
  sql_agent_running?: boolean | null;
  databases?: DatabaseInfo[];
  [key: string]: any;
}

// ── Sessions ──────────────────────────────────────────────────
export interface Session {
  session_id: number;
  login_name?: string | null;
  host_name?: string | null;
  program_name?: string | null;
  db_name?: string | null;
  status?: string | null;
  cpu_time?: number | null;
  reads?: number | null;
  writes?: number | null;
  logical_reads?: number | null;
  memory_usage?: number | null;
  command?: string | null;
  wait_type?: string | null;
  wait_time_ms?: number | null;
  blocking_session_id?: number | null;
  last_request_start_time?: string | null;
  sql_text?: string | null;
  [key: string]: any;
}

// ── Blocking ──────────────────────────────────────────────────
export interface BlockedSession {
  session_id: number;
  login_name?: string | null;
  host_name?: string | null;
  db_name?: string | null;
  wait_type?: string | null;
  wait_time_ms?: number | null;
  sql_text?: string | null;
  [key: string]: any;
}

export interface BlockingChain {
  blocker: Session;
  blocked: BlockedSession[];
  wait_type?: string | null;
  wait_duration_ms?: number | null;
  [key: string]: any;
}

export interface BlockingResult {
  has_blocking: boolean;
  chains?: BlockingChain[];
  blockers?: Session[];
  blocked_sessions?: BlockedSession[];
  blocking_chains?: BlockingChain[];
  [key: string]: any;
}

// ── Deadlocks ─────────────────────────────────────────────────
export interface DeadlockProcess {
  process_id: string;
  login?: string | null;
  hostname?: string | null;
  db_name?: string | null;
  client_app?: string | null;
  wait_type?: string | null;
  wait_resource?: string | null;
  sql_text?: string | null;
  [key: string]: any;
}

export interface DeadlockResource {
  resource_type: string;
  db_name?: string | null;
  object_name?: string | null;
  mode?: string | null;
  waiters: string[];
  [key: string]: any;
}

export interface DeadlockResult {
  deadlock_id?: string | null;
  timestamp?: string | null;
  victims: string[];
  processes: DeadlockProcess[];
  resources: DeadlockResource[];
  [key: string]: any;
}

// ── Agent Jobs ────────────────────────────────────────────────
export interface AgentJob {
  job_name: string;
  job_id: string;
  step_name?: string | null;
  run_date?: string | null;
  run_duration_seconds?: number | null;
  message?: string | null;
  status: string;
  [key: string]: any;
}

export interface AgentJobResult {
  available: boolean;
  reason?: string | null;
  jobs: AgentJob[];
  [key: string]: any;
}

// ── Error Log ─────────────────────────────────────────────────
export interface ErrorLogEntry {
  log_date: string;
  process_info?: string | null;
  text: string;
  is_error?: boolean;
  severity?: string;
  [key: string]: any;
}

// ── Timeline ──────────────────────────────────────────────────
export interface TimelineEvent {
  event_type: string;
  title: string;
  timestamp: string;
  description: string;
  severity: string;
  source?: string;
  [key: string]: any;
}

// ── Query Store ───────────────────────────────────────────────
export interface QueryStoreDatabaseInfo {
  name: string;
  state: string;
}

export interface QueryStoreOverview {
  enabled: boolean;
  readonly_reason?: string | null;
  actual_state?: string | null;
  max_plans_per_query?: number | null;
  query_capture_mode?: string | null;
  current_storage_size_mb?: number | null;
  max_storage_size_mb?: number | null;
  databases_with_qs?: QueryStoreDatabaseInfo[];
  [key: string]: any;
}

export interface ExpensiveQuery {
  query_id: number;
  query_hash?: string | null;
  query_text_snippet?: string | null;
  query_sql_text?: string | null;
  plan_id?: number | null;
  avg_cpu_ms?: number | null;
  avg_duration_ms?: number | null;
  avg_logical_reads?: number | null;
  execution_count?: number | null;
  total_cpu_ms?: number | null;
  first_seen?: string | null;
  last_seen?: string | null;
  is_regressed: boolean;
  [key: string]: any;
}

export interface QueryRegression {
  query_id: number;
  query_text_snippet?: string | null;
  recent_avg_cpu_ms?: number | null;
  prior_avg_cpu_ms?: number | null;
  cpu_increase_pct?: number | null;
  recent_avg_duration_ms?: number | null;
  prior_avg_duration_ms?: number | null;
  duration_increase_pct?: number | null;
  recent_executions?: number | null;
  [key: string]: any;
}

// ── Backups ───────────────────────────────────────────────────
export interface BackupEntry {
  database_name: string;
  backup_type: string;
  backup_type_desc?: string;
  backup_start_date?: string;
  backup_finish_date?: string;
  duration_seconds?: number | null;
  backup_size_gb?: number | null;
  compressed_size_gb?: number | null;
  compression_ratio?: number | null;
  device_name?: string | null;
  is_password_protected?: boolean;
  recovery_model?: string | null;
  [key: string]: any;
}

export interface RecoveryReadiness {
  database_name: string;
  recovery_model: string;
  last_full_backup?: string | null;
  last_diff_backup?: string | null;
  last_log_backup?: string | null;
  full_backup_age_hours?: number | null;
  diff_backup_age_hours?: number | null;
  log_backup_age_hours?: number | null;
  recovery_point_objective_risk: string;
  issues: string[];
  recommendations: string[];
  [key: string]: any;
}

// ── Schema Diff ───────────────────────────────────────────────
export interface SchemaDiffConfig {
  source_db: string;
  target_db: string;
  include_tables?: boolean;
  include_views?: boolean;
  include_procedures?: boolean;
  include_indexes?: boolean;
}

export interface DiffDetail {
  field: string;
  source_value?: string | null;
  target_value?: string | null;
}

export interface SchemaDifference {
  object_type: string;
  object_name: string;
  change_type: string;
  details: DiffDetail[];
  source_definition?: string | null;
  target_definition?: string | null;
  [key: string]: any;
}

export interface DiffSummary {
  tables_added: number;
  tables_removed: number;
  tables_modified: number;
  views_added: number;
  views_removed: number;
  views_modified: number;
  columns_changed: number;
  indexes_changed: number;
}

export interface SchemaDiffResult {
  summary: DiffSummary;
  differences: SchemaDifference[];
  generated_script: string;
  [key: string]: any;
}

// ── Toolkit ───────────────────────────────────────────────────
export type RiskLevel = 'read_only' | 'caution' | 'destructive';

export interface Script {
  id: string;
  name: string;
  category: string;
  description: string;
  sql: string;
  risk_level: RiskLevel;
  tags?: string[];
  min_sql_version?: string | null;
  notes?: string | null;
  [key: string]: any;
}

// ── Permissions ───────────────────────────────────────────────
export interface Login {
  name: string;
  type_desc?: string;
  is_disabled: boolean;
  is_locked?: boolean | null;
  default_database?: string;
  create_date?: string;
  modify_date?: string;
  has_sysadmin: boolean;
  [key: string]: any;
}

export interface DbUser {
  username: string;
  db_name: string;
  type_desc?: string;
  login_name?: string | null;
  default_schema?: string | null;
  create_date?: string | null;
  roles: string[];
  [key: string]: any;
}

export interface RoleMember {
  member_name: string;
  member_type?: string | null;
}

export interface Role {
  role_name: string;
  role_type: string;
  members: RoleMember[];
  [key: string]: any;
}

// ── High Availability ─────────────────────────────────────────
export interface AGReplica {
  name: string;
  role?: string;
  availability_mode?: string;
  failover_mode?: string;
  operational_state?: string;
  synchronization_health?: string;
  [key: string]: any;
}

export interface AGDatabase {
  name: string;
  sync_state?: string;
  is_suspended?: boolean;
  redo_queue_size_kb?: number;
  [key: string]: any;
}

export interface AvailabilityGroup {
  ag_name: string;
  primary_replica?: string;
  health_state?: string;
  sync_health?: string;
  databases: AGDatabase[];
  replicas: AGReplica[];
  [key: string]: any;
}

export interface HAStatus {
  available: boolean;
  reason?: string | null;
  groups: AvailabilityGroup[];
  [key: string]: any;
}

// ── Database ──────────────────────────────────────────────────
export interface Database {
  name: string;
  state?: string;
  recovery_model?: string;
  size_mb?: number | null;
  log_size_mb?: number | null;
  compatibility_level?: number | null;
  is_read_only?: boolean | null;
  create_date?: string | null;
  [key: string]: any;
}

