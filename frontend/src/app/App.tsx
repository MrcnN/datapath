import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import styles from './App.module.css';
import Router from './Router';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';

export default function App() {
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

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
