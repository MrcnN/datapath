import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from '../features/dashboard/DashboardPage';
import InstancesPage from '../features/instances/InstancesPage';
import IncidentCenterPage from '../features/incidents/IncidentCenterPage';
import QueryPerformancePage from '../features/query-performance/QueryPerformancePage';
import BackupRecoveryPage from '../features/backups/BackupRecoveryPage';
import SchemaDiffPage from '../features/schema-diff/SchemaDiffPage';
import ToolkitPage from '../features/toolkit/ToolkitPage';
import PermissionsPage from '../features/permissions/PermissionsPage';
import HAPage from '../features/high-availability/HAPage';
import IndexesPage from '../features/indexes/IndexesPage';
import WaitStatsPage from '../features/wait-stats/WaitStatsPage';
import StoragePage from '../features/storage/StoragePage';
import TempDBPage from '../features/tempdb/TempDBPage';
import BufferPoolPage from '../features/tempdb/BufferPoolPage';
import AgentJobsPage from '../features/agent-jobs/AgentJobsPage';
import ExtendedEventsPage from '../features/extended-events/ExtendedEventsPage';
import CatalogPage from '../features/catalog/CatalogPage';

export default function Router() {
  return (
    <Routes>
      {/* 1. Genel Bakış & Filo */}
      <Route path="/" element={<DashboardPage />} />
      <Route path="/instances" element={<InstancesPage />} />
      <Route path="/catalog" element={<CatalogPage />} />

      {/* 2. Sorgu & Performans Zekası */}
      <Route path="/query-performance" element={<QueryPerformancePage />} />
      <Route path="/query-rewriter" element={<QueryPerformancePage initialTab="REWRITER_STUDIO" />} />
      <Route path="/execution-plan" element={<QueryPerformancePage initialTab="PLAN_VIEWER" />} />
      <Route path="/waits" element={<WaitStatsPage />} />

      {/* 3. İndeksler & Akıllı Bakım */}
      <Route path="/indexes" element={<IndexesPage />} />
      <Route path="/hypothetical-indexes" element={<IndexesPage initialTab="hypothetical" />} />
      <Route path="/maintenance-planner" element={<IndexesPage initialTab="maintenance" />} />

      {/* 4. Bellek, TempDB & Depolama */}
      <Route path="/tempdb" element={<TempDBPage />} />
      <Route path="/buffer-pool" element={<BufferPoolPage />} />
      <Route path="/storage" element={<StoragePage />} />

      {/* 5. Kriz, Güvenilirlik & Yedekleme */}
      <Route path="/incidents" element={<IncidentCenterPage />} />
      <Route path="/extended-events" element={<ExtendedEventsPage />} />
      <Route path="/backups" element={<BackupRecoveryPage />} />
      <Route path="/high-availability" element={<HAPage />} />

      {/* 6. Yönetim, Güvenlik & Denetim */}
      <Route path="/best-practices" element={<ToolkitPage initialTab="benchmark" />} />
      <Route path="/permissions" element={<PermissionsPage />} />
      <Route path="/agent-jobs" element={<AgentJobsPage />} />
      <Route path="/schema-diff" element={<SchemaDiffPage />} />
      <Route path="/toolkit" element={<ToolkitPage initialTab="scripts" />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
