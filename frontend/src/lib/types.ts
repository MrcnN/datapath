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

// ── Index Intelligence ────────────────────────────────────────
export interface MissingIndex {
  database_name: string;
  schema_name: string;
  table_name: string;
  impact_score: number;
  user_seeks: number;
  user_scans: number;
  avg_total_user_cost: number;
  avg_user_impact: number;
  equality_columns?: string | null;
  inequality_columns?: string | null;
  included_columns?: string | null;
  suggested_index_name: string;
  create_statement: string;
  [key: string]: any;
}

export interface UnusedIndex {
  database_name: string;
  schema_name: string;
  table_name: string;
  index_name: string;
  index_type: string;
  size_mb: number;
  user_seeks: number;
  user_scans: number;
  user_lookups: number;
  user_updates: number;
  read_writes_ratio: string;
  drop_statement: string;
  [key: string]: any;
}

export interface IndexFragmentation {
  database_name: string;
  schema_name: string;
  table_name: string;
  index_name: string;
  index_type: string;
  avg_fragmentation_percent: number;
  page_count: number;
  size_mb: number;
  recommended_action: 'REBUILD' | 'REORGANIZE' | 'HEALTHY' | string;
  maintenance_statement: string;
  [key: string]: any;
}

export interface IndexSummary {
  total_missing_indexes: number;
  max_impact_score: number;
  total_unused_indexes: number;
  total_wasted_mb: number;
  fragmented_indexes_count: number;
  is_demo?: boolean;
  [key: string]: any;
}

// ── Wait Statistics ───────────────────────────────────────────
export interface WaitStatEntry {
  wait_type: string;
  category: string;
  waiting_tasks_count: number;
  wait_time_ms: number;
  wait_time_sec: number;
  max_wait_time_ms: number;
  signal_wait_time_ms: number;
  signal_wait_percent: number;
  resource_wait_ms: number;
  percentage_of_total: number;
  description: string;
  recommendation: string;
  [key: string]: any;
}

export interface CategoryWaitSummary {
  category: string;
  total_wait_ms: number;
  percentage: number;
  wait_count: number;
  [key: string]: any;
}

export interface WaitStatsSummary {
  total_wait_time_ms: number;
  total_signal_wait_ms: number;
  signal_wait_ratio_percent: number;
  has_cpu_pressure: boolean;
  top_category: string;
  total_waiting_tasks: number;
  categories: CategoryWaitSummary[];
  wait_stats: WaitStatEntry[];
  is_demo?: boolean;
  [key: string]: any;
}

// ── Storage & Files ───────────────────────────────────────────
export interface DatabaseFile {
  database_name: string;
  file_id: number;
  name: string;
  file_type: string;
  physical_name: string;
  size_mb: number;
  used_mb: number;
  free_mb: number;
  free_percent: number;
  growth: string;
  is_percent_growth: boolean;
  max_size: string;
  growth_recommendation_sql?: string | null;
  [key: string]: any;
}

export interface LogSpaceUsage {
  database_name: string;
  log_size_mb: number;
  log_space_used_percent: number;
  status: number;
  log_reuse_wait_desc: string;
  [key: string]: any;
}

export interface AutogrowthEvent {
  start_time: string;
  database_name: string;
  file_name: string;
  file_type: string;
  growth_mb: number;
  duration_ms: number;
  [key: string]: any;
}

export interface StorageSummary {
  total_data_size_mb: number;
  total_log_size_mb: number;
  total_free_space_mb: number;
  files_with_percent_growth_count: number;
  high_log_usage_dbs_count: number;
  files: DatabaseFile[];
  log_spaces: LogSpaceUsage[];
  autogrowth_events: AutogrowthEvent[];
  is_demo?: boolean;
  [key: string]: any;
}

// ── TempDB & Memory Intelligence ──────────────────────────────
export interface TempDBSpaceBreakdown {
  user_objects_mb: number;
  internal_objects_mb: number;
  version_store_mb: number;
  unallocated_space_mb: number;
  total_size_mb: number;
  user_objects_pct: number;
  internal_objects_pct: number;
  version_store_pct: number;
  unallocated_pct: number;
  [key: string]: any;
}

export interface TempDBFile {
  file_id: number;
  name: string;
  physical_name: string;
  size_mb: number;
  free_mb: number;
  free_percent: number;
  growth: string;
  is_percent_growth: boolean;
  [key: string]: any;
}

export interface MemoryClerk {
  clerk_type: string;
  friendly_name: string;
  size_mb: number;
  percentage_of_total: number;
  [key: string]: any;
}

export interface TempDBMemorySummary {
  space_breakdown: TempDBSpaceBreakdown;
  tempdb_files: TempDBFile[];
  file_count: number;
  cpu_cores: number;
  sizing_equal: boolean;
  file_count_status: 'OPTIMAL' | 'WARNING' | string;
  file_count_recommendation: string;
  allocation_contention_detected: boolean;
  contention_description: string;
  page_life_expectancy_sec: number;
  ple_status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | string;
  ple_recommendation: string;
  buffer_cache_hit_ratio: number;
  total_server_memory_mb: number;
  target_server_memory_mb: number;
  memory_utilization_pct: number;
  top_memory_clerks: MemoryClerk[];
  is_demo?: boolean;
  [key: string]: any;
}




