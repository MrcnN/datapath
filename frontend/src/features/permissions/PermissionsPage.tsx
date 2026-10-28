import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import {
  getLogins,
  getDatabaseUsers,
  getRoles,
  getDatabases,
} from '../../lib/api';
import type { Login, DbUser, Role, Database } from '../../lib/types';
import styles from './PermissionsPage.module.css';

type TabType = 'logins' | 'users' | 'roles';

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('logins');
  const [logins, setLogins] = useState<Login[]>([]);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('master');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const dbs = await getDatabases().catch(() => []);
        setDatabases(dbs);
        if (dbs.length > 0) setSelectedDb(dbs[0].name);
      } catch {
        // ignore
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === 'logins') {
          const data = await getLogins();
          setLogins(data);
        } else if (activeTab === 'users') {
          const data = await getDatabaseUsers(selectedDb);
          setUsers(data);
        } else if (activeTab === 'roles') {
          const data = await getRoles();
          setRoles(data);
        }
      } catch (err: any) {
        setError(err.message || 'İzin ve güvenlik verileri alınamadı');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeTab, selectedDb]);

  const loginColumns: Column<Login>[] = [
    {
      key: 'name',
      label: 'Login Adı',
      sortable: true,
      render: (l) => <strong>{l.name}</strong>,
    },
    {
      key: 'type_desc',
      label: 'Tür',
      render: (l) => l.type_desc || '—',
    },
    {
      key: 'is_disabled',
      label: 'Hesap Durumu',
      render: (l) => (
        <StatusBadge
          variant={l.is_disabled ? 'error' : 'success'}
          label={l.is_disabled ? 'Devre Dışı' : 'Aktif'}
        />
      ),
    },
    {
      key: 'has_sysadmin',
      label: 'Sysadmin Yetkisi',
      render: (l) => (
        <StatusBadge
          variant={l.has_sysadmin ? 'warning' : 'neutral'}
          label={l.has_sysadmin ? 'SYSADMIN' : 'Standart'}
        />
      ),
    },
    {
      key: 'default_database',
      label: 'Varsayılan DB',
      render: (l) => l.default_database || 'master',
    },
    {
      key: 'create_date',
      label: 'Oluşturulma Tarihi',
      render: (l) => (l.create_date ? new Date(l.create_date).toLocaleDateString('tr-TR') : '—'),
    },
  ];

  const userColumns: Column<DbUser>[] = [
    {
      key: 'username',
      label: 'Kullanıcı Adı',
      sortable: true,
      render: (u) => <strong>{u.username}</strong>,
    },
    {
      key: 'login_name',
      label: 'Eşleşen Login',
      render: (u) => u.login_name || '—',
    },
    {
      key: 'type_desc',
      label: 'Kullanıcı Türü',
      render: (u) => u.type_desc || '—',
    },
    {
      key: 'roles',
      label: 'Üye Olduğu Roller',
      render: (u) => {
        if (!u.roles || u.roles.length === 0) return '—';
        return u.roles.join(', ');
      },
    },
    {
      key: 'default_schema',
      label: 'Varsayılan Şema',
      render: (u) => u.default_schema || 'dbo',
    },
  ];

  const roleColumns: Column<Role>[] = [
    {
      key: 'role_name',
      label: 'Rol Adı',
      sortable: true,
      render: (r) => <strong>{r.role_name}</strong>,
    },
    {
      key: 'role_type',
      label: 'Rol Kapsamı',
      render: (r) => (
        <StatusBadge
          variant={r.role_type === 'server' ? 'info' : 'neutral'}
          label={r.role_type === 'server' ? 'Sunucu Rolü' : 'Veritabanı Rolü'}
        />
      ),
    },
    {
      key: 'members',
      label: 'Rol Üyeleri',
      render: (r) => {
        if (!r.members || r.members.length === 0) return '—';
        return r.members.map((m) => m.member_name).join(', ');
      },
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="İzinler ve Güvenlik (Permissions & Security)"
        subtitle="Sunucu loginleri, veritabanı kullanıcıları, roller ve yetki envanteri"
      />

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'logins' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('logins')}
        >
          Sunucu Loginleri ({logins.length})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Veritabanı Kullanıcıları
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'roles' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Rol Envanteri ({roles.length})
        </button>
      </div>

      {activeTab === 'users' && databases.length > 0 && (
        <div className={styles.controls}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Veritabanı Seçin:
          </label>
          <select
            className={styles.select}
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
          >
            {databases.map((db) => (
              <option key={db.name} value={db.name}>
                {db.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <LoadingSpinner message="Güvenlik envanteri taranıyor..." />}
      {error && <ErrorState message={error} onRetry={() => setActiveTab(activeTab)} />}

      {!loading && !error && (
        <>
          {activeTab === 'logins' && (
            <DataTable
              columns={loginColumns}
              data={logins}
              emptyMessage="Login kaydı bulunamadı."
            />
          )}
          {activeTab === 'users' && (
            <DataTable
              columns={userColumns}
              data={users}
              emptyMessage="Bu veritabanında kullanıcı bulunamadı."
            />
          )}
          {activeTab === 'roles' && (
            <DataTable
              columns={roleColumns}
              data={roles}
              emptyMessage="Rol kaydı bulunamadı."
            />
          )}
        </>
      )}
    </div>
  );
}
