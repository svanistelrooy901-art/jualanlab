import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '../../i18n/lang';

/** Bottom sheet built on <dialog>: focus trap, Escape and the back gesture come from the browser. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="mx-auto mb-0 mt-auto w-full max-w-xl rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto px-4 pb-6 pt-3" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border-strong" aria-hidden />
          <div className="mb-3 flex items-center gap-2">
            <h2 className="flex-1 text-lg font-extrabold">{title}</h2>
            <button type="button" onClick={onClose} className="btn-ghost min-h-10 px-3 text-sm">
              {t.app.close}
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
      {children}
    </p>
  );
}
