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

export interface ConfigurationItem {
  configuration_id: number;
  name: string;
  description: string;
  value: number;
  value_in_use: number;
  recommended_value?: string | null;
  is_dynamic: boolean;
  is_advanced: boolean;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'INFO';
  impact_description: string;
  remediation_sql?: string | null;
  [key: string]: any;
}

export interface ServerConfigurationSummary {
  compliance_score: number;
  total_configurations: number;
  optimal_count: number;
  warning_count: number;
  critical_count: number;
  items: ConfigurationItem[];
  remediation_script: string;
  is_demo?: boolean;
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
  elapsed_time_ms?: number | null;
  current_statement?: string | null;
  tempdb_allocations_mb?: number | null;
  memory_grant_mb?: number | null;
  open_transaction_count?: number | null;
  transaction_isolation_level?: string | null;
  is_root_blocker?: boolean;
  blocked_session_count?: number;
  kill_statement?: string | null;
  [key: string]: any;
}

export interface LiveProcessSummary {
  total_active_sessions: number;
  running_sessions: number;
  blocked_sessions: number;
  root_blockers_count: number;
  total_tempdb_mb: number;
  total_memory_grant_mb: number;
  sessions: Session[];
  is_demo?: boolean;
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
  database_name?: string;
  query_text_snippet?: string | null;
  old_avg_cpu_ms?: number | null;
  new_avg_cpu_ms?: number | null;
  cpu_delta_pct?: number | null;
  old_avg_duration_ms?: number | null;
  new_avg_duration_ms?: number | null;
  duration_delta_pct?: number | null;
  old_execution_count?: number | null;
  new_execution_count?: number | null;
  plan_id_good?: number | null;
  plan_id_bad?: number | null;
  severity?: 'CRITICAL' | 'WARNING';
  root_cause?: string | null;
  remediation_sql?: string | null;
  [key: string]: any;
}

export interface PlanWarningQuery {
  plan_handle: string;
  query_hash?: string | null;
  database_name: string;
  query_text: string;
  warning_type: string;
  warning_severity: 'CRITICAL' | 'WARNING' | 'INFO';
  warning_details: string;
  recommendation: string;
  execution_count: number;
  total_cpu_ms: number;
  avg_cpu_ms: number;
  total_logical_reads: number;
  avg_logical_reads: number;
  max_grant_kb?: number | null;
  last_execution_time?: string | null;
  [key: string]: any;
}

export interface PlanAntiPatternsSummary {
  is_demo?: boolean;
  total_flagged_plans: number;
  spill_count: number;
  implicit_conversion_count: number;
  missing_index_count: number;
  high_grant_count: number;
  queries: PlanWarningQuery[];
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

export interface DatabaseIntegrityCheck {
  database_name: string;
  last_clean_checkdb: string;
  days_since_checkdb?: number | null;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | string;
  page_verify_option: string;
  is_read_only: boolean;
  integrity_check_sql: string;
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

export interface SecurityFinding {
  id: string;
  category: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  database_name?: string | null;
  principal_name?: string | null;
  title: string;
  description: string;
  risk_impact: string;
  remediation_sql: string;
  [key: string]: any;
}

export interface SecurityAuditSummary {
  security_score: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  passed_checks_count: number;
  findings: SecurityFinding[];
  hardening_script: string;
  is_demo?: boolean;
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

export interface TableStatistic {
  database_name: string;
  schema_name: string;
  table_name: string;
  stats_name: string;
  last_updated?: string | null;
  rows_total: number;
  rows_sampled: number;
  modification_counter: number;
  staleness_percent: number;
  status: 'FRESH' | 'WARNING' | 'STALE' | string;
  update_statement: string;
  [key: string]: any;
}

export interface RedundantIndex {
  database_name: string;
  schema_name: string;
  table_name: string;
  redundant_index_name: string;
  redundant_columns: string;
  redundant_included_columns?: string | null;
  covering_index_name: string;
  covering_columns: string;
  covering_included_columns?: string | null;
  size_mb: number;
  redundancy_type: 'EXACT_DUPLICATE' | 'PREFIX_OVERLAP' | string;
  explanation: string;
  drop_statement: string;
  [key: string]: any;
}

export interface IndexSummary {
  total_missing_indexes: number;
  max_impact_score: number;
  total_unused_indexes: number;
  total_wasted_mb: number;
  fragmented_indexes_count: number;
  stale_statistics_count?: number;
  redundant_indexes_count?: number;
  redundant_wasted_mb?: number;
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

export interface FileIOLatency {
  database_name: string;
  file_name: string;
  file_type: string;
  physical_name: string;
  drive_letter: string;
  read_latency_ms: number;
  write_latency_ms: number;
  overall_latency_ms: number;
  num_of_reads: number;
  num_of_writes: number;
  io_stall_ms: number;
  status: 'EXCELLENT' | 'NORMAL' | 'WARNING' | 'CRITICAL' | string;
  [key: string]: any;
}

export interface DriveIOSummary {
  drive_letter: string;
  avg_read_latency_ms: number;
  avg_write_latency_ms: number;
  total_reads: number;
  total_writes: number;
  status: 'EXCELLENT' | 'NORMAL' | 'WARNING' | 'CRITICAL' | string;
  file_count: number;
  [key: string]: any;
}

export interface GrowthHistoryPoint {
  date: string;
  size_mb: number;
}

export interface DatabaseGrowthForecast {
  database_name: string;
  current_size_mb: number;
  size_30_days_ago_mb?: number | null;
  size_60_days_ago_mb?: number | null;
  size_90_days_ago_mb?: number | null;
  growth_last_30_days_mb: number;
  growth_percent_30_days: number;
  daily_growth_mb: number;
  projected_size_90_days_mb: number;
  drive_letter: string;
  drive_free_space_mb: number;
  days_until_disk_full?: number | null;
  status: 'CRITICAL_CAPACITY' | 'RAPID_GROWTH' | 'MODERATE' | 'STABLE';
  history_points: GrowthHistoryPoint[];
  [key: string]: any;
}

export interface DatabaseVLFInfo {
  database_name: string;
  vlf_count: number;
  active_vlf_count: number;
  inactive_vlf_count: number;
  log_size_mb: number;
  avg_vlf_size_mb: number;
  recovery_model: string;
  log_reuse_wait_desc: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | string;
  recommendation: string;
  remediation_script: string;
  [key: string]: any;
}

export interface StorageSummary {
  total_data_size_mb: number;
  total_log_size_mb: number;
  total_free_space_mb: number;
  files_with_percent_growth_count: number;
  high_log_usage_dbs_count: number;
  critical_io_files_count?: number;
  critical_vlf_dbs_count?: number;
  files: DatabaseFile[];
  log_spaces: LogSpaceUsage[];
  autogrowth_events: AutogrowthEvent[];
  file_io_latencies?: FileIOLatency[];
  drive_io_summaries?: DriveIOSummary[];
  growth_forecasts?: DatabaseGrowthForecast[];
  vlf_infos?: DatabaseVLFInfo[];
  fastest_growing_db?: string | null;
  total_30_day_growth_mb?: number;
  min_disk_runway_days?: number | null;
  is_demo?: boolean;
  [key: string]: any;
}

export interface OpenTransaction {
  session_id: number;
  transaction_id: number;
  transaction_name: string;
  database_name: string;
  login_name: string;
  host_name: string;
  program_name: string;
  begin_time: string;
  duration_seconds: number;
  duration_formatted: string;
  transaction_state: string;
  transaction_type: string;
  session_status: string;
  is_dormant_active: boolean;
  open_transaction_count: number;
  log_bytes_used_mb: number;
  log_records_count: number;
  sql_text?: string | null;
  blocking_session_count: number;
  kill_script: string;
}

export interface LogReuseWaitDetail {
  database_name: string;
  recovery_model: string;
  log_reuse_wait_desc: string;
  log_size_mb: number;
  log_used_percent: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | string;
  root_cause_explanation: string;
  impact_summary: string;
  remediation_steps: string[];
  remediation_script: string;
}

export interface OpenTransactionsSummary {
  total_active_transactions: number;
  dormant_open_transactions_count: number;
  longest_running_duration_sec: number;
  longest_running_spid?: number | null;
  total_log_space_held_mb: number;
  transactions: OpenTransaction[];
  log_reuse_waits: LogReuseWaitDetail[];
  is_demo?: boolean;
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

export interface BufferPoolDatabaseUsage {
  database_name: string;
  buffer_pool_mb: number;
  percentage_of_buffer_pool: number;
  dirty_pages_mb: number;
  clean_pages_mb: number;
  total_pages_count: number;
}

export interface BufferPoolTopObject {
  database_name: string;
  schema_name: string;
  table_name: string;
  index_name?: string | null;
  index_type: string;
  buffer_mb: number;
  page_count: number;
}

export interface PlanCacheBloatAnalysis {
  total_cached_plans_count: number;
  single_use_plans_count: number;
  single_use_plans_percent: number;
  total_cache_size_mb: number;
  wasted_adhoc_mb: number;
  wasted_memory_percent: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | string;
  optimize_for_adhoc_enabled: boolean;
  recommendation: string;
  remediation_script: string;
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
  buffer_pool_db_distribution?: BufferPoolDatabaseUsage[];
  buffer_pool_top_objects?: BufferPoolTopObject[];
  plan_cache_bloat?: PlanCacheBloatAnalysis | null;
  is_demo?: boolean;
  [key: string]: any;
}

// ── SQL Server Agent Jobs ─────────────────────────────────────
export interface JobStepHistory {
  step_id: number;
  step_name: string;
  run_status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'IN_PROGRESS' | 'RETRY' | 'UNKNOWN' | string;
  run_date: string;
  run_duration_sec: number;
  message: string;
  [key: string]: any;
}

export interface AgentJobDetail {
  job_id: string;
  name: string;
  enabled: boolean;
  category: string;
  description?: string | null;
  last_run_status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'NEVER_RUN' | 'UNKNOWN' | string;
  last_run_date?: string | null;
  last_run_duration_sec?: number | null;
  next_run_date?: string | null;
  last_failed_step_id?: number | null;
  last_failed_message?: string | null;
  steps?: JobStepHistory[];
  [key: string]: any;
}

export interface AgentJobsSummary {
  agent_running: boolean;
  total_jobs: number;
  enabled_jobs: number;
  disabled_jobs: number;
  failed_jobs_count: number;
  running_jobs_count: number;
  jobs: AgentJobDetail[];
  is_demo?: boolean;
  [key: string]: any;
}

// ── Extended Events (XE) ───────────────────────────────────────
export interface XESession {
  name: string;
  status: 'RUNNING' | 'STOPPED' | string;
  auto_start: boolean;
  total_buffer_size_kb: number;
  max_memory_kb: number;
  event_retention_mode: string;
  dropped_buffer_count: number;
  dropped_event_count: number;
  largest_event_dropped_size: number;
  targets: string[];
  target_types: string;
  event_count: number;
  start_time?: string | null;
  alter_state_script: string;
  drop_script: string;
  [key: string]: any;
}

export interface RingBufferEvent {
  event_type: 'deadlock' | 'error_reported' | 'connectivity' | 'memory_broker' | string;
  timestamp: string;
  severity?: number | null;
  error_number?: number | null;
  message: string;
  database_name?: string | null;
  session_id?: number | null;
  details?: string | null;
  xml_payload?: string | null;
  [key: string]: any;
}

export interface XETemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  overhead_impact: 'VERY_LOW' | 'LOW' | 'MODERATE' | string;
  target_type: 'ring_buffer' | 'event_file' | string;
  create_script: string;
  [key: string]: any;
}

export interface ExtendedEventsSummary {
  total_sessions: number;
  running_sessions: number;
  stopped_sessions: number;
  system_health_running: boolean;
  total_dropped_events: number;
  severe_errors_count: number;
  deadlocks_in_ring_count: number;
  sessions: XESession[];
  recent_events: RingBufferEvent[];
  templates: XETemplate[];
  is_demo?: boolean;
  [key: string]: any;
}

// ── Multi-Server Profiles & Environment ──────────────────────
export type EnvironmentType =
  | 'PRODUCTION'
  | 'READ_ONLY_REPLICA'
  | 'STAGING'
  | 'DEVELOPMENT'
  | 'DISASTER_RECOVERY';

export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  default_database: string;
  username?: string | null;
  use_windows_auth: boolean;
  environment: EnvironmentType;
  role: string;
  driver: string;
  timeout: number;
  description?: string | null;
  is_active: boolean;
  is_online: boolean;
  latency_ms?: number | null;
  version?: string | null;
  edition?: string | null;
  cpu_count?: number | null;
  total_memory_gb?: number | null;
}

export interface ServerProfileCreate {
  name: string;
  host: string;
  port: number;
  default_database: string;
  username?: string | null;
  password?: string | null;
  use_windows_auth: boolean;
  environment: EnvironmentType;
  role: string;
  driver?: string;
  timeout?: number;
  description?: string | null;
}

export interface ServerProfileListResponse {
  active_server_id: string;
  total_count: number;
  servers: ServerProfile[];
}

export interface ServerPingResponse {
  server_id: string;
  server_name: string;
  is_online: boolean;
  latency_ms: number;
  message: string;
  checked_at: string;
}

export interface SQLAlertDetail {
  name: string;
  message_id: number;
  severity: number;
  enabled: boolean;
  delay_between_responses: number;
  last_occurrence?: string | null;
  occurrence_count: number;
  has_notification: boolean;
  operator_name?: string | null;
  is_best_practice_missing: boolean;
  status: string;
  [key: string]: any;
}

export interface DatabaseMailItem {
  mailitem_id: number;
  recipients: string;
  subject: string;
  send_request_date: string;
  send_request_user: string;
  sent_status: string;
  last_mod_date?: string | null;
  error_description?: string | null;
  [key: string]: any;
}

export interface DatabaseMailStatus {
  mail_queue_status: string;
  total_failed_items: number;
  total_unsent_items: number;
  total_sent_items: number;
  recent_failed_items: DatabaseMailItem[];
  restart_queue_sql: string;
  cleanup_failed_sql: string;
  [key: string]: any;
}

export interface AlertsAndMailSummary {
  total_alerts: number;
  critical_alerts_missing_count: number;
  has_unnotified_alerts: boolean;
  mail_status: DatabaseMailStatus;
  alerts: SQLAlertDetail[];
  create_missing_alerts_sql: string;
  is_demo?: boolean;
  [key: string]: any;
}

export interface SuspectPageRecord {
  database_id: number;
  database_name: string;
  file_id: number;
  page_id: number;
  event_type: number;
  event_desc: string;
  error_count: number;
  last_update_date: string;
  page_restore_sql: string;
  [key: string]: any;
}

export interface IntegrityAndCorruptionSummary {
  total_databases: number;
  healthy_checkdb_count: number;
  stale_checkdb_count: number;
  critical_checkdb_count: number;
  suspect_pages_count: number;
  has_active_corruption: boolean;
  checkdb_list: DatabaseIntegrityCheck[];
  suspect_pages: SuspectPageRecord[];
  is_demo?: boolean;
  [key: string]: any;
}

export interface QueryMemoryGrantDetail {
  session_id: number;
  request_id: number;
  scheduler_id: number;
  dop: number;
  request_time: string;
  grant_time?: string | null;
  requested_memory_mb: number;
  granted_memory_mb: number;
  required_memory_mb: number;
  used_memory_mb: number;
  max_used_memory_mb: number;
  ideal_memory_mb: number;
  is_waiting: boolean;
  wait_time_ms: number;
  resource_semaphore_id: number;
  query_text: string;
  waste_ratio_percent: number;
  [key: string]: any;
}

export interface MemoryGrantsSummary {
  total_grant_count: number;
  waiting_grant_count: number;
  total_granted_mb: number;
  total_requested_mb: number;
  semaphore_pressure: string;
  grants: QueryMemoryGrantDetail[];
  is_demo?: boolean;
  [key: string]: any;
}

export interface TempDBContentionWaiter {
  session_id: number;
  wait_type: string;
  wait_duration_ms: number;
  wait_resource: string;
  page_type: 'PFS' | 'GAM' | 'SGAM' | 'DATA_PAGE' | string;
  blocking_session_id?: number | null;
  status_desc: string;
  [key: string]: any;
}

export interface TempDBSessionSpaceUsage {
  session_id: number;
  login_name: string;
  program_name: string;
  host_name?: string | null;
  user_objects_alloc_mb: number;
  user_objects_dealloc_mb: number;
  user_net_mb: number;
  internal_objects_alloc_mb: number;
  internal_objects_dealloc_mb: number;
  internal_net_mb: number;
  is_sleeping_open_tran: boolean;
  remediation_sql: string;
  [key: string]: any;
}

export interface TempDBContentionSummary {
  has_contention: boolean;
  contention_severity: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  pfs_wait_count: number;
  gam_wait_count: number;
  sgam_wait_count: number;
  total_active_waiters: number;
  recommended_action: string;
  remediation_sql: string;
  waiters: TempDBContentionWaiter[];
  top_space_consumers: TempDBSessionSpaceUsage[];
  is_demo?: boolean;
  [key: string]: any;
}

export interface HealthPillar {
  id: string;
  name: string;
  weight: number;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  findings: string[];
  recommendations: string[];
}

export interface HealthScoreResponse {
  overall_score: number;
  grade: 'A' | 'B' | 'C' | 'F';
  status: 'healthy' | 'warning' | 'critical';
  summary: string;
  pillars: HealthPillar[];
  critical_issues_count: number;
  warning_issues_count: number;
  server_name: string;
  calculated_at: string;
  is_live: boolean;
}

export type WebhookServiceType = 'slack' | 'teams' | 'discord' | 'generic';

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  service_type: WebhookServiceType;
  min_severity: number;
  notify_on_deadlocks: boolean;
  notify_on_suspect_pages: boolean;
  notify_on_high_severity_errors: boolean;
  channel_name?: string | null;
}

export interface WebhookTestResponse {
  success: boolean;
  status_code: number;
  message: string;
}










