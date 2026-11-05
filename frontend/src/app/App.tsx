import React, { useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import styles from './App.module.css';
import Router from './Router';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import { AuthProvider } from '../features/auth/AuthContext';

function AppLayout() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('datapath_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('datapath_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (isAuthPage) {
    return (
      <main className={styles.authLayout}>
        <Router />
      </main>
    );
  }

  return (
    <div className={styles.appLayout}>
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div
        className={`${styles.mainArea} ${
          collapsed ? styles.mainAreaCollapsed : ''
        }`}
      >
        <TopBar collapsed={collapsed} onToggle={toggleSidebar} />
        <main className={styles.pageContent}>
          <Router />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
