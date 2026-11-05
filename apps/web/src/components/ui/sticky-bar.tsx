import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A bar pinned to the bottom of the screen on phones only (the main action stays in thumb reach).
 * It is rendered straight into <body> so page animations (transforms) cannot break `fixed`.
 */
export function StickyBar({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">{children}</div>
    </div>,
    document.body,
  );
}
