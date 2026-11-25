import { useEffect, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** When provided, body + footer are wrapped in a <form> so Enter submits. */
  onSubmit?: () => void;
  width?: string;
}

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, subtitle, onClose, children, footer, onSubmit, width = 'max-w-2xl' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Focus the first field on open and restore focus on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const target = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('input, select, textarea');
    (target ?? el?.querySelector<HTMLElement>('button'))?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    // Simple focus trap
    if (e.key === 'Tab' && ref.current) {
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const inner = (
    <>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-200 bg-ink-50 px-6 py-3">{footer}</div>}
    </>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-6 pt-14" onKeyDown={onKeyDown}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} overflow-hidden rounded-lg border border-ink-200 bg-white shadow-2xl`}>
        <div className="flex items-start justify-between border-b border-ink-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 rounded p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
        {onSubmit ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              onSubmit();
            }}
            noValidate
          >
            {inner}
          </form>
        ) : (
          inner
        )}
      </div>
    </div>
  );
}

export function Field({ label, error, children, className = '' }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {error && <span className="ml-2 font-normal normal-case tracking-normal text-red-600">{error}</span>}
      </label>
      {children}
    </div>
  );
}
