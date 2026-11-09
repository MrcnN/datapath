import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from '../features/dashboard/DashboardPage';
import InstancesPage from '../features/instances/InstancesPage';
import IncidentCenterPage from '../features/incidents/IncidentCenterPage';
import QueryPerformancePage from '../features/query-performance/QueryPerformancePage';
import QueryRewriterPage from '../features/query-performance/QueryRewriterPage';
import ExecutionPlanPage from '../features/query-performance/ExecutionPlanPage';
import BackupRecoveryPage from '../features/backups/BackupRecoveryPage';
import SchemaDiffPage from '../features/schema-diff/SchemaDiffPage';
import ToolkitPage from '../features/toolkit/ToolkitPage';
import BestPracticesPage from '../features/toolkit/BestPracticesPage';
import PermissionsPage from '../features/permissions/PermissionsPage';
import RoleManagementPage from '../features/permissions/RoleManagementPage';
import HAPage from '../features/high-availability/HAPage';
import IndexesPage from '../features/indexes/IndexesPage';
import HypotheticalIndexPage from '../features/indexes/HypotheticalIndexPage';
import MaintenancePlannerPage from '../features/indexes/MaintenancePlannerPage';
import StatisticsPage from '../features/indexes/StatisticsPage';
import WaitStatsPage from '../features/wait-stats/WaitStatsPage';
import StoragePage from '../features/storage/StoragePage';
import TempDBPage from '../features/tempdb/TempDBPage';
import BufferPoolPage from '../features/tempdb/BufferPoolPage';
import AgentJobsPage from '../features/agent-jobs/AgentJobsPage';
import ExtendedEventsPage from '../features/extended-events/ExtendedEventsPage';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import ProfilePage from '../features/auth/ProfilePage';

export default function Router() {
  return (
    <Routes>
      {/* 1. Genel Bakış */}
      <Route path="/" element={<DashboardPage />} />
      <Route path="/instances" element={<InstancesPage />} />

      {/* 2. Sorgu & Performans */}
      <Route path="/query-performance" element={<QueryPerformancePage />} />
      <Route path="/time-travel" element={<QueryPerformancePage initialTab="TIME_TRAVEL" />} />
      <Route path="/cardinality-drift" element={<QueryPerformancePage initialTab="CARDINALITY_DRIFT" />} />
      <Route path="/query-rewriter" element={<QueryRewriterPage />} />
      <Route path="/execution-plan" element={<ExecutionPlanPage />} />
      <Route path="/waits" element={<QueryPerformancePage initialTab="WAITS" />} />

      {/* 3. İndeks & Bakım */}
      <Route path="/indexes" element={<IndexesPage />} />
      <Route path="/statistics" element={<StatisticsPage />} />
      <Route path="/hypothetical-indexes" element={<HypotheticalIndexPage />} />
      <Route path="/maintenance-planner" element={<MaintenancePlannerPage />} />

      {/* 4. Bellek & Depolama */}
      <Route path="/tempdb" element={<StoragePage initialTab="tempdb" />} />
      <Route path="/buffer-pool" element={<StoragePage initialTab="buffer_pool" />} />
      <Route path="/storage" element={<StoragePage />} />
      <Route path="/capacity-runway" element={<StoragePage initialTab="growth" />} />
      <Route path="/partitioning" element={<StoragePage initialTab="partitioning" />} />

      {/* 5. Kilitlenme & Güvenilirlik */}
      <Route path="/incidents" element={<IncidentCenterPage />} />
      <Route path="/extended-events" element={<IncidentCenterPage initialTab="extended-events" />} />
      <Route path="/backups" element={<BackupRecoveryPage />} />
      <Route path="/high-availability" element={<HAPage />} />

      {/* 6. Güvenlik & Yönetim */}
      <Route path="/best-practices" element={<BestPracticesPage />} />
      <Route path="/permissions" element={<PermissionsPage />} />
      <Route path="/role-management" element={<RoleManagementPage />} />
      <Route path="/agent-jobs" element={<AgentJobsPage />} />
      <Route path="/schema-diff" element={<SchemaDiffPage />} />
      <Route path="/online-migrations" element={<SchemaDiffPage initialTab="online_migrations" />} />
      <Route path="/toolkit" element={<ToolkitPage initialTab="scripts" />} />

      {/* 7. Kimlik Doğrulama & Kullanıcı Profili (Login şuanlık devre dışı bırakıldı, doğrudan ana panoya yönlendirilir) */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/profile" element={<ProfilePage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
