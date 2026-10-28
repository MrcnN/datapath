import React, { useState, useEffect } from 'react';
import { Search, Wrench } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import CodeBlock from '../../components/ui/CodeBlock';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { getToolkitScripts, getToolkitCategories } from '../../lib/api';
import type { Script } from '../../lib/types';
import styles from './ToolkitPage.module.css';

export default function ToolkitPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [scriptsData, catsData] = await Promise.all([
          getToolkitScripts({ category: selectedCategory, search }),
          getToolkitCategories().catch(() => []),
        ]);
        setScripts(scriptsData);
        if (catsData.length > 0) {
          setCategories(catsData);
        }
      } catch (err: any) {
        setError(err.message || 'Betikler yüklenirken bir hata oluştu');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedCategory, search]);

  const getRiskBadge = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'read_only':
        return <span className={styles.riskReadOnly}>Salt Okunur</span>;
      case 'caution':
        return <span className={styles.riskCaution}>Dikkat</span>;
      case 'destructive':
        return <span className={styles.riskDestructive}>Tehlikeli</span>;
      default:
        return <span className={styles.riskReadOnly}>{risk}</span>;
    }
  };

  return (
    <div className={styles.container}>
      <PageHeader
        title="DBA Araç Seti (Toolkit)"
        subtitle="Kategorize edilmiş, aranabilir ve tek tıkla kopyalanabilir profesyonel T-SQL teşhis betikleri"
      />

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Betik adı, açıklama, SQL veya etiketlerde ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.categories}>
          <button
            type="button"
            className={`${styles.categoryPill} ${!selectedCategory ? styles.categoryPillActive : ''}`}
            onClick={() => setSelectedCategory('')}
          >
            Tümü
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.categoryPill} ${selectedCategory === cat ? styles.categoryPillActive : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingSpinner message="Betikler yükleniyor..." />}
      {error && <ErrorState message={error} onRetry={() => setSearch(search)} />}

      {!loading && !error && scripts.length === 0 && (
        <EmptyState
          title="Betik bulunamadı"
          message="Arama filtrenize uygun bir T-SQL betiği bulunamadı. Lütfen arama teriminizi değiştirin."
        />
      )}

      {!loading && !error && scripts.length > 0 && (
        <div className={styles.grid}>
          {scripts.map((script) => (
            <div key={script.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{script.name}</h3>
                <div className={styles.badges}>
                  {getRiskBadge(script.risk_level)}
                </div>
              </div>

              <p className={styles.cardDesc}>{script.description}</p>

              {script.tags && script.tags.length > 0 && (
                <div className={styles.tags}>
                  {script.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className={styles.codeArea}>
                <CodeBlock code={script.sql} language="sql" maxLines={8} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
