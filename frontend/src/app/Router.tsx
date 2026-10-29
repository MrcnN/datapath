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
import AgentJobsPage from '../features/agent-jobs/AgentJobsPage';
import ExtendedEventsPage from '../features/extended-events/ExtendedEventsPage';

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/instances" element={<InstancesPage />} />
      <Route path="/incidents" element={<IncidentCenterPage />} />
      <Route path="/extended-events" element={<ExtendedEventsPage />} />
      <Route path="/query-performance" element={<QueryPerformancePage />} />
      <Route path="/indexes" element={<IndexesPage />} />
      <Route path="/waits" element={<WaitStatsPage />} />
      <Route path="/storage" element={<StoragePage />} />
      <Route path="/tempdb" element={<TempDBPage />} />
      <Route path="/backups" element={<BackupRecoveryPage />} />
      <Route path="/agent-jobs" element={<AgentJobsPage />} />
      <Route path="/schema-diff" element={<SchemaDiffPage />} />
      <Route path="/toolkit" element={<ToolkitPage />} />
      <Route path="/permissions" element={<PermissionsPage />} />
      <Route path="/high-availability" element={<HAPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
