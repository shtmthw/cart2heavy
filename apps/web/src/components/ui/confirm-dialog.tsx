import type { ReactNode } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" loading={loading ?? false} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
