import { useCallback, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { copyTextToClipboard } from '../../utils/copyTextToClipboard';

export interface Moa_CopyToClipboardButtonProps {
  text: string;
  className?: string;
  size?: 'xxs' | 'xs' | 'sm' | 'md';
  variant?: 'dark-outline' | 'secondary' | 'primary';
  label?: string;
  copiedLabel?: string;
  disabled?: boolean;
  onCopied?: () => void;
  onError?: () => void;
}

export function Moa_CopyToClipboardButton({
  text,
  className = '',
  size = 'xs',
  variant = 'dark-outline',
  label,
  copiedLabel,
  disabled = false,
  onCopied,
  onError,
}: Moa_CopyToClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!text.trim()) {
      onError?.();
      return;
    }
    const ok = await copyTextToClipboard(text);
    if (!ok) {
      onError?.();
      return;
    }
    setCopied(true);
    onCopied?.();
    window.setTimeout(() => setCopied(false), 1800);
  }, [onCopied, onError, text]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || !text.trim()}
      onClick={() => void handleCopy()}
      aria-live="polite"
    >
      <Icon name={copied ? 'check' : 'copy'} className="text-xs" aria-hidden />
      {label ? <span className="ml-1">{copied && copiedLabel ? copiedLabel : label}</span> : null}
    </Button>
  );
}
