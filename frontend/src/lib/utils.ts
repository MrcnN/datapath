/* ============================================
   Utility Functions
   ============================================ */

/** Format bytes into a human-readable string */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/** Format megabytes into a human-readable string */
export function formatMB(mb: number): string {
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/** Format milliseconds into a human-readable duration */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

/** Format seconds into h m s */
export function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Format a date string or Date object */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return String(date);
  }
}

/** Format relative time (e.g. "2 hours ago") */
export function formatRelativeTime(date: string | Date | undefined | null): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  } catch {
    return '—';
  }
}

/** Truncate a string to a max length */
export function truncate(str: string, maxLen = 80): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}…`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Format a number with thousands separators */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/** Copy text to clipboard, returns true on success */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

/** SQL keyword highlighting helper — returns array of token objects */
export interface SqlToken {
  type: 'keyword' | 'string' | 'number' | 'comment' | 'operator' | 'plain';
  value: string;
}

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'MERGE',
  'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW', 'INDEX', 'PROCEDURE', 'FUNCTION',
  'TRIGGER', 'DATABASE', 'SCHEMA',
  'BEGIN', 'END', 'IF', 'ELSE', 'WHILE', 'RETURN', 'DECLARE', 'EXEC', 'EXECUTE',
  'WITH', 'AS', 'HAVING', 'GROUP', 'BY', 'ORDER', 'DESC', 'ASC',
  'TOP', 'DISTINCT', 'ALL', 'UNION', 'EXCEPT', 'INTERSECT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'NOLOCK', 'READUNCOMMITTED', 'TRANSACTION', 'COMMIT', 'ROLLBACK',
  'GO', 'USE', 'PRINT', 'CAST', 'CONVERT', 'COALESCE', 'ISNULL', 'NULLIF',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'VARCHAR', 'NVARCHAR', 'CHAR',
  'NCHAR', 'TEXT', 'NTEXT', 'BIT', 'FLOAT', 'REAL', 'DECIMAL', 'NUMERIC',
  'DATETIME', 'DATETIME2', 'DATE', 'TIME', 'UNIQUEIDENTIFIER', 'VARBINARY',
]);

export function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  // Simple regex-based tokenizer
  const regex = /('(?:[^']|'')*')|(--.*)|(\/\*[\s\S]*?\*\/)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)|([\s\S])/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sql)) !== null) {
    const [, str, lineComment, blockComment, num, word, other] = match;
    if (str !== undefined) {
      tokens.push({ type: 'string', value: str });
    } else if (lineComment !== undefined) {
      tokens.push({ type: 'comment', value: lineComment });
    } else if (blockComment !== undefined) {
      tokens.push({ type: 'comment', value: blockComment });
    } else if (num !== undefined) {
      tokens.push({ type: 'number', value: num });
    } else if (word !== undefined) {
      const upper = word.toUpperCase();
      tokens.push({ type: SQL_KEYWORDS.has(upper) ? 'keyword' : 'plain', value: word });
    } else if (other !== undefined) {
      tokens.push({ type: 'plain', value: other });
    }
  }

  return tokens;
}
