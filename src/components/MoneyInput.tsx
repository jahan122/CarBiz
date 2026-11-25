import { useLayoutEffect, useRef } from 'react';
import { formatMoneyInput, numberToWords } from '../utils';

interface Props {
  /** Already-formatted text, e.g. "1,220,000". */
  value: string;
  onChange: (formatted: string) => void;
  placeholder?: string;
  'data-autofocus'?: boolean;
}

/** Amount field: auto-groups digits as you type and shows the amount in words (Lacs / Crore) underneath. */
export default function MoneyInput({ value, onChange, placeholder, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Put the caret back where the user was typing (reformatting would otherwise jump it to the end).
  useLayoutEffect(() => {
    if (caret.current !== null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
    }
    caret.current = null;
  });

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const digitsBefore = raw.slice(0, e.target.selectionStart ?? raw.length).replace(/\D/g, '').length;
    const formatted = formatMoneyInput(raw);
    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < digitsBefore) {
      if (/\d/.test(formatted[pos])) seen++;
      pos++;
    }
    caret.current = pos;
    onChange(formatted);
  }

  const words = numberToWords(Number(value.replace(/,/g, '')));

  return (
    <>
      <input ref={ref} className="input tabular-nums" inputMode="numeric" value={value} onChange={handle} placeholder={placeholder} {...rest} />
      <p className="mt-1 min-h-[1rem] text-xs font-medium leading-4 text-brand-600" aria-live="polite">{words}</p>
    </>
  );
}
