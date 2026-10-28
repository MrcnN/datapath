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

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/instances" element={<InstancesPage />} />
      <Route path="/incidents" element={<IncidentCenterPage />} />
      <Route path="/query-performance" element={<QueryPerformancePage />} />
      <Route path="/backups" element={<BackupRecoveryPage />} />
      <Route path="/schema-diff" element={<SchemaDiffPage />} />
      <Route path="/toolkit" element={<ToolkitPage />} />
      <Route path="/permissions" element={<PermissionsPage />} />
      <Route path="/high-availability" element={<HAPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
