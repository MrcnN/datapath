import React from 'react';
import { tokenizeSql } from '../../lib/utils';
import CopyButton from './CopyButton';
import styles from './CodeBlock.module.css';

export interface CodeBlockProps {
  code: string;
  language?: string;
  showCopy?: boolean;
  maxHeight?: string;
  maxLines?: number;
}

export default function CodeBlock({
  code,
  language = 'sql',
  showCopy = true,
  maxHeight,
  maxLines,
}: CodeBlockProps) {
  const tokens = language === 'sql' ? tokenizeSql(code) : null;
  const calculatedMaxHeight = maxLines ? `${maxLines * 22}px` : maxHeight;

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <span className={styles.lang}>{language}</span>
        {showCopy && <CopyButton text={code} label="Kopyala" />}
      </div>
      <pre
        className={styles.pre}
        style={calculatedMaxHeight ? { maxHeight: calculatedMaxHeight, overflow: 'auto' } : undefined}
      >
        {tokens
          ? tokens.map((tok, i) => (
              <span key={i} className={styles[tok.type]}>
                {tok.value}
              </span>
            ))
          : code}
      </pre>
    </div>
  );
}
