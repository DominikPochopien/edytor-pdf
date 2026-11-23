import { ArrowDownToLine, ArrowUpToLine, Copy, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditObject, HexColor } from '../../../domain/objects';
import { frameToDisplay } from '../../../domain/objects';
import { useEditorActions } from '../../hooks/useEditorActions';
import { useViewerStore } from '../../store/viewerStore';
import { NumberField } from '../common/NumberField';

const MAX_SIZE = 14_400;
const HALF_TURN = 180;

export function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface ColorRowProps {
  readonly label: string;
  readonly noneLabel?: string;
  readonly value: HexColor | null;
  readonly fallback: HexColor;
  readonly onChange: (value: HexColor | null) => void;
  readonly testId: string;
  readonly children?: ReactNode;
}

/** Colour picker, optionally with a "none" checkbox. */
export function ColorRow({
  label,
  noneLabel,
  value,
  fallback,
  onChange,
  testId,
  children,
}: ColorRowProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={label}
        data-testid={testId}
        value={value ?? fallback}
        disabled={value === null}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-8 w-10 cursor-pointer rounded border border-neutral-300 bg-white disabled:opacity-40 dark:border-neutral-600"
      />
      {noneLabel !== undefined && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === null}
            onChange={(event) => {
              onChange(event.target.checked ? null : fallback);
            }}
          />
          {noneLabel}
        </label>
      )}
      {children}
    </div>
  );
}

export const actionButton =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-neutral-300 px-2 py-1.5 text-xs hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700';

/** Position, size and rotation. Text boxes have only a width: their height follows the text. */
export function GeometrySection({
  object,
  onWidth,
}: {
  readonly object: EditObject;
  readonly onWidth?: (width: number) => void;
}) {
  const { t } = useTranslation();
  const actions = useEditorActions();
  const page = useViewerStore((s) => s.document?.info.pages[object.pageIndex]);
  if (page === undefined) {
    return null;
  }
  const display = frameToDisplay(object.frame, page);
  const left = display.center.x - display.width / 2;
  const top = display.center.y - display.height / 2;
  const { id } = object;

  return (
    <>
      <Section title={t('properties.position')}>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t('properties.x')}
            testId="prop-x"
            value={left}
            onCommit={(x) => {
              actions.reshape(id, (d) => ({ ...d, center: { x: x + d.width / 2, y: d.center.y } }));
            }}
          />
          <NumberField
            label={t('properties.y')}
            testId="prop-y"
            value={top}
            onCommit={(y) => {
              actions.reshape(id, (d) => ({
                ...d,
                center: { x: d.center.x, y: y + d.height / 2 },
              }));
            }}
          />
        </div>
      </Section>
      <Section title={t('properties.size')}>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={onWidth === undefined ? t('properties.width') : t('properties.boxWidth')}
            testId="prop-width"
            value={display.width}
            min={1}
            max={MAX_SIZE}
            onCommit={(width) => {
              if (onWidth === undefined) {
                actions.reshape(id, (d) => ({ ...d, width }));
              } else {
                onWidth(width);
              }
            }}
          />
          {onWidth === undefined && (
            <NumberField
              label={t('properties.height')}
              testId="prop-height"
              value={display.height}
              min={1}
              max={MAX_SIZE}
              onCommit={(height) => {
                actions.reshape(id, (d) => ({ ...d, height }));
              }}
            />
          )}
          <NumberField
            label={t('properties.rotation')}
            testId="prop-rotation"
            value={display.angle}
            min={-HALF_TURN}
            max={HALF_TURN}
            onCommit={(angle) => {
              actions.reshape(id, (d) => ({ ...d, angle }));
            }}
          />
        </div>
      </Section>
    </>
  );
}

export function ArrangeSection() {
  const { t } = useTranslation();
  const actions = useEditorActions();
  return (
    <Section title={t('properties.arrange')}>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={actionButton} onClick={actions.duplicateSelected}>
          <Copy aria-hidden className="size-4" />
          {t('properties.duplicate')}
        </button>
        <button
          type="button"
          className={`${actionButton} text-red-700 dark:text-red-300`}
          onClick={actions.removeSelected}
        >
          <Trash2 aria-hidden className="size-4" />
          {t('properties.delete')}
        </button>
        <button
          type="button"
          className={actionButton}
          onClick={() => {
            actions.arrange('front');
          }}
        >
          <ArrowUpToLine aria-hidden className="size-4" />
          {t('properties.toFront')}
        </button>
        <button
          type="button"
          className={actionButton}
          onClick={() => {
            actions.arrange('back');
          }}
        >
          <ArrowDownToLine aria-hidden className="size-4" />
          {t('properties.toBack')}
        </button>
      </div>
    </Section>
  );
}
