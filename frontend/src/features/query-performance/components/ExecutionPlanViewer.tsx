import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileCode,
  Copy,
  Check,
  AlertTriangle,
  Layers,
  Code2,
  RefreshCw,
  Search,
  CheckCircle,
} from 'lucide-react';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import PlanOperatorCard from './PlanOperatorCard';
import { parseExecutionPlan } from '../../../lib/api';
import type { ParsedExecutionPlan, PlanOperatorNode } from '../../../lib/types';
import styles from './ExecutionPlanViewer.module.css';

interface ExecutionPlanViewerProps {
  initialPlanHandle?: string;
  initialPlanXml?: string;
}

const SAMPLE_PLAN_XML = `<?xml version="1.0" encoding="utf-8"?>
<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan" Version="1.5" Build="15.0.2000.5">
  <BatchSequence>
    <Batch>
      <Statements>
        <StmtSimple StatementText="SELECT c.CustomerName, o.OrderID, o.OrderDate, o.TotalAmount FROM Customers c INNER JOIN Orders o ON c.CustomerID = o.CustomerID WHERE o.OrderDate &gt;= '2026-01-01' ORDER BY o.TotalAmount DESC;" StatementType="SELECT" StatementSubTreeCost="0.0845" StatementOptmLevel="FULL">
          <QueryPlan CompileCPU="18" CompileMemory="1024">
            <MissingIndexes>
              <MissingIndexGroup Impact="78.2">
                <MissingIndex Database="[ProductionDB]" Schema="[dbo]" Table="[Orders]">
                  <ColumnGroup Usage="EQUALITY">
                    <Column Name="[CustomerID]"/>
                  </ColumnGroup>
                  <ColumnGroup Usage="INEQUALITY">
                    <Column Name="[OrderDate]"/>
                  </ColumnGroup>
                  <ColumnGroup Usage="INCLUDE">
                    <Column Name="[TotalAmount]"/>
                    <Column Name="[OrderID]"/>
                  </ColumnGroup>
                </MissingIndex>
              </MissingIndexGroup>
            </MissingIndexes>
            <RelOp NodeId="0" PhysicalOp="Sort" LogicalOp="Top N Sort" EstimateRows="25" EstimateIO="0.012" EstimateCPU="0.008" EstimatedTotalSubtreeCost="0.0845">
              <OutputList>
                <ColumnReference Column="CustomerName"/>
                <ColumnReference Column="OrderID"/>
                <ColumnReference Column="TotalAmount"/>
              </OutputList>
              <Sort>
                <RelOp NodeId="1" PhysicalOp="Hash Match" LogicalOp="Inner Join" EstimateRows="120" EstimateIO="0.024" EstimateCPU="0.015" EstimatedTotalSubtreeCost="0.0645">
                  <OutputList>
                    <ColumnReference Column="CustomerName"/>
                    <ColumnReference Column="OrderID"/>
                    <ColumnReference Column="TotalAmount"/>
                  </OutputList>
                  <Hash>
                    <RelOp NodeId="2" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan" EstimateRows="500" EstimateIO="0.035" EstimateCPU="0.005" EstimatedTotalSubtreeCost="0.040">
                      <OutputList>
                        <ColumnReference Column="CustomerID"/>
                        <ColumnReference Column="CustomerName"/>
                      </OutputList>
                      <IndexScan>
                        <Object Database="[ProductionDB]" Schema="[dbo]" Table="[Customers]" Index="[PK_Customers]"/>
                      </IndexScan>
                    </RelOp>
                    <RelOp NodeId="3" PhysicalOp="Index Seek" LogicalOp="Index Seek" EstimateRows="120" EstimateIO="0.012" EstimateCPU="0.002" EstimatedTotalSubtreeCost="0.014">
                      <OutputList>
                        <ColumnReference Column="CustomerID"/>
                        <ColumnReference Column="OrderID"/>
                        <ColumnReference Column="TotalAmount"/>
                      </OutputList>
                      <Warnings>
                        <PlanAffectingConvert ConvertIssue="Seek Plan" Expression="CONVERT_IMPLICIT(nvarchar(50),@1,0)"/>
                      </Warnings>
                      <IndexScan>
                        <Object Database="[ProductionDB]" Schema="[dbo]" Table="[Orders]" Index="[IX_Orders_CustomerID]"/>
                        <SeekPredicates>
                          <SeekPredicate>c.CustomerID = o.CustomerID AND o.OrderDate &gt;= '2026-01-01'</SeekPredicate>
                        </SeekPredicates>
                      </IndexScan>
                    </RelOp>
                  </Hash>
                </RelOp>
              </Sort>
            </RelOp>
          </QueryPlan>
        </StmtSimple>
      </Statements>
    </Batch>
  </BatchSequence>
</ShowPlanXML>`;

export default function ExecutionPlanViewer({
  initialPlanHandle,
  initialPlanXml,
}: ExecutionPlanViewerProps) {
  const [plan, setPlan] = useState<ParsedExecutionPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<PlanOperatorNode | null>(null);
  const [showXmlInput, setShowXmlInput] = useState<boolean>(false);
  const [xmlText, setXmlText] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<boolean>(false);

  const loadPlan = async (xmlString?: string, handle?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await parseExecutionPlan({
        plan_xml: xmlString,
        plan_handle: handle,
      });
      setPlan(data);
      if (data.root_operator) {
        setSelectedNode(data.root_operator);
      }
    } catch (err: any) {
      setError(err.message || 'Yürütme planı ayrıştırılamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPlanXml || initialPlanHandle) {
      loadPlan(initialPlanXml, initialPlanHandle);
    } else {
      // Load sample plan by default for instant visual feedback
      loadPlan(SAMPLE_PLAN_XML);
    }
  }, [initialPlanXml, initialPlanHandle]);

  const handleCopyIndex = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedIndex(true);
    setTimeout(() => setCopiedIndex(false), 2500);
  };

  const handleParseCustomXml = () => {
    if (!xmlText.trim()) return;
    loadPlan(xmlText);
    setShowXmlInput(false);
  };

  return (
    <div className={styles.container}>
      {/* Top Stats & Actions Bar */}
      <div className={styles.topBar}>
        <div className={styles.statsLeft}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>İfade Türü:</span>
            <span className={styles.statVal}>{plan?.statement_type || 'N/A'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Toplam Alt Ağaç Maliyeti:</span>
            <span className={styles.statVal} style={{ color: 'var(--accent-primary, #3b82f6)' }}>
              {plan?.total_cost.toFixed(4) || '0.0000'}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Derleme CPU / Bellek:</span>
            <span className={styles.statVal}>
              {plan?.compile_cpu_ms} ms / {plan?.compile_memory_kb} KB
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Optimizasyon Seviyesi:</span>
            <span className={styles.statVal}>{plan?.optimization_level || 'FULL'}</span>
          </div>
          {plan && plan.warnings_count > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Plan Uyarıları:</span>
              <span className={styles.statVal} style={{ color: '#f59e0b' }}>
                ⚠️ {plan.warnings_count} Uyarı
              </span>
            </div>
          )}
        </div>

        <div className={styles.topBarActions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${showXmlInput ? styles.actionBtnActive : ''}`}
            onClick={() => setShowXmlInput(!showXmlInput)}
          >
            <FileCode size={13} />
            <span>XML / .sqlplan Yapıştır</span>
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => loadPlan(SAMPLE_PLAN_XML)}
            title="Örnek yürütme planını yükle"
          >
            <Sparkles size={13} />
            <span>Örnek Planı Yükle</span>
          </button>
        </div>
      </div>

      {/* XML Input Accordion */}
      {showXmlInput && (
        <div className={styles.xmlInputBox}>
          <textarea
            className={styles.xmlTextarea}
            placeholder="SSMS veya Query Store'dan kopyalanan ShowPlanXML / .sqlplan içeriğini buraya yapıştırın..."
            value={xmlText}
            onChange={(e) => setXmlText(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setShowXmlInput(false)}
            >
              İptal
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnActive}`}
              onClick={handleParseCustomXml}
              disabled={!xmlText.trim()}
            >
              <Layers size={13} />
              <span>Planı Görselleştir</span>
            </button>
          </div>
        </div>
      )}

      {/* Missing Index Recommendation Banner */}
      {plan?.missing_index && (
        <div className={styles.missingIndexBanner}>
          <div className={styles.missingIndexLeft}>
            <span className={styles.impactBadge}>
              %{plan.missing_index.impact_percent} KAZANÇ
            </span>
            <div className={styles.missingIndexInfo}>
              <div className={styles.missingIndexTitle}>
                Sorgu İyileştiricisi Eksik İndeks Tespiti ({plan.missing_index.table_name})
              </div>
              <div className={styles.missingIndexDesc}>
                {plan.missing_index.create_statement}
              </div>
            </div>
          </div>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => handleCopyIndex(plan.missing_index!.create_statement)}
          >
            {copiedIndex ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedIndex ? 'Kopyalandı!' : 'CREATE INDEX Kopyala'}</span>
          </button>
        </div>
      )}

      {loading && <LoadingSpinner message="Yürütme planı operatör ağacı işleniyor..." />}
      {error && <ErrorState message={error} onRetry={() => loadPlan(SAMPLE_PLAN_XML)} />}

      {!loading && !error && plan?.root_operator && (
        <div className={styles.visualizerLayout}>
          {/* Tree Canvas */}
          <div className={styles.treeCanvas}>
            <PlanOperatorCard
              node={plan.root_operator}
              selectedNode={selectedNode}
              onSelectNode={(n) => setSelectedNode(n)}
            />
          </div>

          {/* Inspector Panel */}
          {selectedNode && (
            <div className={styles.inspectorPanel}>
              <div className={styles.inspectorHeader}>
                <h4 className={styles.inspectorTitle}>{selectedNode.physical_op}</h4>
                <span className={styles.nodeIdBadge}>Node ID: {selectedNode.node_id}</span>
              </div>

              <div className={styles.inspectorPropGrid}>
                <div className={styles.propCard}>
                  <span className={styles.propLabel}>Mantıksal İşlem</span>
                  <span className={styles.propValue}>{selectedNode.logical_op}</span>
                </div>
                <div className={styles.propCard}>
                  <span className={styles.propLabel}>Maliyet Payı</span>
                  <span className={styles.propValue} style={{ color: selectedNode.is_expensive ? '#ef4444' : 'var(--text-primary)' }}>
                    %{selectedNode.estimated_cost_percent.toFixed(1)}
                  </span>
                </div>
                <div className={styles.propCard}>
                  <span className={styles.propLabel}>Tahmini CPU</span>
                  <span className={styles.propValue}>{selectedNode.estimated_cpu_cost}</span>
                </div>
                <div className={styles.propCard}>
                  <span className={styles.propLabel}>Tahmini I/O</span>
                  <span className={styles.propValue}>{selectedNode.estimated_io_cost}</span>
                </div>
                <div className={styles.propCard}>
                  <span className={styles.propLabel}>Tahmini Satır</span>
                  <span className={styles.propValue}>{selectedNode.estimated_rows.toLocaleString()}</span>
                </div>
                <div className={styles.propCard}>
                  <span className={styles.propLabel}>Gerçek Satır</span>
                  <span className={styles.propValue}>
                    {selectedNode.actual_rows !== null && selectedNode.actual_rows !== undefined
                      ? selectedNode.actual_rows.toLocaleString()
                      : 'Statik Plan'}
                  </span>
                </div>
              </div>

              {selectedNode.warnings.length > 0 && (
                <div className={styles.warningsBox}>
                  <span className={styles.sectionLabel} style={{ color: '#f59e0b' }}>
                    Operatör Uyarıları
                  </span>
                  {selectedNode.warnings.map((w, i) => (
                    <div key={i} className={styles.warningItem}>
                      <AlertTriangle size={12} />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedNode.predicate && (
                <div className={styles.predicateBox}>
                  <span className={styles.sectionLabel}>Arama / Filtreleme Koşulu (Predicate)</span>
                  <div className={styles.predicateText}>{selectedNode.predicate}</div>
                </div>
              )}

              {selectedNode.output_list && selectedNode.output_list.length > 0 && (
                <div className={styles.predicateBox}>
                  <span className={styles.sectionLabel}>Çıktı Kolonları (Output List)</span>
                  <div className={styles.outputColumns}>
                    {selectedNode.output_list.map((col, idx) => (
                      <span key={idx} className={styles.colPill}>
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
