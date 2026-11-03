import React from 'react';
import {
  Crosshair,
  Layers,
  GitMerge,
  Cpu,
  ArrowUpDown,
  Filter,
  Calculator,
  Database,
  AlertTriangle,
  FileQuestion,
  type LucideIcon,
} from 'lucide-react';
import type { PlanOperatorNode } from '../../../lib/types';
import styles from './ExecutionPlanViewer.module.css';

interface PlanOperatorCardProps {
  node: PlanOperatorNode;
  selectedNode: PlanOperatorNode | null;
  onSelectNode: (node: PlanOperatorNode) => void;
}

export default function PlanOperatorCard({
  node,
  selectedNode,
  onSelectNode,
}: PlanOperatorCardProps) {
  const isSelected = selectedNode?.node_id === node.node_id;

  const getOperatorIcon = (physOp: string): LucideIcon => {
    const op = physOp.toLowerCase();
    if (op.includes('seek')) return Crosshair;
    if (op.includes('scan')) return Layers;
    if (op.includes('loop')) return GitMerge;
    if (op.includes('hash')) return Cpu;
    if (op.includes('sort')) return ArrowUpDown;
    if (op.includes('filter')) return Filter;
    if (op.includes('compute') || op.includes('scalar')) return Calculator;
    return Database;
  };

  const Icon = getOperatorIcon(node.physical_op);
  const costPct = node.estimated_cost_percent;
  const isHighCost = costPct >= 25;
  const barColor = isHighCost ? '#ef4444' : costPct >= 10 ? '#f59e0b' : '#3b82f6';

  return (
    <div className={styles.treeNodeWrapper}>
      {/* Operator Node Card */}
      <div
        className={`${styles.operatorCard} ${
          isSelected ? styles.operatorCardSelected : ''
        } ${isHighCost ? styles.operatorCardExpensive : ''}`}
        onClick={() => onSelectNode(node)}
      >
        <div className={styles.operatorTop}>
          <div className={styles.opIconTitle}>
            <Icon size={14} className={styles.opIcon} />
            <span className={styles.opTitle} title={node.physical_op}>
              {node.physical_op}
            </span>
          </div>
          {node.warnings.length > 0 && (
            <span className={styles.warningBadge} title={node.warnings.join('\n')}>
              <AlertTriangle size={13} />
            </span>
          )}
        </div>

        {node.object_name && (
          <span className={styles.objectTarget} title={node.object_name}>
            {node.object_name}
          </span>
        )}

        <div className={styles.costBarBox}>
          <div className={styles.costMeta}>
            <span>Maliyet:</span>
            <span className={isHighCost ? styles.costValHigh : styles.costVal}>
              %{costPct.toFixed(1)}
            </span>
          </div>
          <div className={styles.costBar}>
            <div
              className={styles.costFill}
              style={{ width: `${Math.min(100, costPct)}%`, backgroundColor: barColor }}
            />
          </div>
        </div>
      </div>

      {/* Children branches if any */}
      {node.children && node.children.length > 0 && (
        <div className={styles.childrenBranches}>
          {node.children.map((child) => (
            <PlanOperatorCard
              key={child.node_id}
              node={child}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
