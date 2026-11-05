import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-6">
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden /> Previous
      </Button>
      <span className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}
