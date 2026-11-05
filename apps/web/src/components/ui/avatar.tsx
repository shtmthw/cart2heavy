import { cn, initials } from '../../lib/utils';

export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const size = 'size-8 text-xs';
  if (src) {
    return <img src={src} alt="" className={cn(size, 'rounded-full object-cover', className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        size,
        'grid place-items-center rounded-full bg-accent-soft font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
