import { useId, useState } from 'react';

interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly onCommit: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly testId?: string;
}

const DISPLAY_DECIMALS = 1;
/** Shift + arrow key changes the value ten times faster. */
const LARGE_STEP_FACTOR = 10;

function format(value: number): string {
  return String(Number(value.toFixed(DISPLAY_DECIMALS))).replace('.', ',');
}

function parse(text: string): number | null {
  const value = Number(text.replace(',', '.').trim());
  return text.trim() === '' || Number.isNaN(value) ? null : value;
}

/** Number input that accepts a Polish decimal comma and applies the value on Enter or blur. */
export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  testId,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (): void => {
    if (draft === null) {
      return;
    }
    const parsed = parse(draft);
    setDraft(null);
    if (parsed === null) {
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    if (clamped !== value) {
      onCommit(clamped);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-neutral-600 dark:text-neutral-300">
        {label}
      </label>
      <input
        id={id}
        data-testid={testId}
        inputMode="decimal"
        value={draft ?? format(value)}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
          }
          if (event.key === 'Escape') {
            setDraft(null);
          }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const delta =
              (event.key === 'ArrowUp' ? 1 : -1) * step * (event.shiftKey ? LARGE_STEP_FACTOR : 1);
            const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value + delta));
            setDraft(null);
            onCommit(next);
          }
        }}
        className="h-8 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm tabular-nums dark:border-neutral-600 dark:bg-neutral-900"
      />
    </div>
  );
}
