import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../lib/utils';
import styles from './CopyButton.module.css';

interface CopyButtonProps {
  text: string;
  label?: string;
}

export default function CopyButton({ text, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      className={`${styles.btn} ${copied ? styles.copied : ''}`}
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Copy ${label}`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}
