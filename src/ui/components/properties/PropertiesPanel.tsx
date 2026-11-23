import { ArrowDownToLine, ArrowUpToLine, Copy, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { HexColor, ShapeObject } from '../../../domain/objects';
import { findObject, frameToDisplay } from '../../../domain/objects';
import { useEditorActions } from '../../hooks/useEditorActions';
import { useEditorStore } from '../../store/editorStore';
import { useViewerStore } from '../../store/viewerStore';
import { NumberField } from '../common/NumberField';

const PERCENT = 100;
const MAX_STROKE_WIDTH = 72;
const MAX_SIZE = 14_400;
const HALF_TURN = 180;
const DEFAULT_FILL: HexColor = '#fde68a';
const DEFAULT_STROKE: HexColor = '#dc2626';

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
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
  readonly noneLabel: string;
  readonly value: HexColor | null;
  readonly fallback: HexColor;
  readonly onChange: (value: HexColor | null) => void;
  readonly testId: string;
}

function ColorRow({ label, noneLabel, value, fallback, onChange, testId }: ColorRowProps) {
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
    </div>
  );
}

const actionButton =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-neutral-300 px-2 py-1.5 text-xs hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700';

function ShapeProperties({ shape }: { readonly shape: ShapeObject }) {
  const { t } = useTranslation();
  const actions = useEditorActions();
  const page = useViewerStore((s) => s.document?.info.pages[shape.pageIndex]);
  if (page === undefined) {
    return null;
  }
  const display = frameToDisplay(shape.frame, page);
  const left = display.center.x - display.width / 2;
  const top = display.center.y - display.height / 2;

  return (
    <>
      <Section title={t('properties.position')}>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t('properties.x')}
            testId="prop-x"
            value={left}
            onCommit={(x) => {
              actions.reshape(shape.id, (d) => ({
                ...d,
                center: { x: x + d.width / 2, y: d.center.y },
              }));
            }}
          />
          <NumberField
            label={t('properties.y')}
            testId="prop-y"
            value={top}
            onCommit={(y) => {
              actions.reshape(shape.id, (d) => ({
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
            label={t('properties.width')}
            testId="prop-width"
            value={display.width}
            min={1}
            max={MAX_SIZE}
            onCommit={(width) => {
              actions.reshape(shape.id, (d) => ({ ...d, width }));
            }}
          />
          <NumberField
            label={t('properties.height')}
            testId="prop-height"
            value={display.height}
            min={1}
            max={MAX_SIZE}
            onCommit={(height) => {
              actions.reshape(shape.id, (d) => ({ ...d, height }));
            }}
          />
          <NumberField
            label={t('properties.rotation')}
            testId="prop-rotation"
            value={display.angle}
            min={-HALF_TURN}
            max={HALF_TURN}
            onCommit={(angle) => {
              actions.reshape(shape.id, (d) => ({ ...d, angle }));
            }}
          />
        </div>
      </Section>
      <Section title={t('properties.stroke')}>
        <ColorRow
          label={t('properties.strokeColor')}
          noneLabel={t('properties.noStroke')}
          value={shape.stroke}
          fallback={DEFAULT_STROKE}
          testId="prop-stroke"
          onChange={(stroke) => {
            actions.restyle(shape.id, { stroke });
          }}
        />
        <div className="mt-2">
          <NumberField
            label={t('properties.strokeWidth')}
            testId="prop-stroke-width"
            value={shape.strokeWidth}
            min={0}
            max={MAX_STROKE_WIDTH}
            step={0.5}
            onCommit={(strokeWidth) => {
              actions.restyle(shape.id, { strokeWidth });
            }}
          />
        </div>
      </Section>
      <Section title={t('properties.fill')}>
        <ColorRow
          label={t('properties.fillColor')}
          noneLabel={t('properties.noFill')}
          value={shape.fill}
          fallback={DEFAULT_FILL}
          testId="prop-fill"
          onChange={(fill) => {
            actions.restyle(shape.id, { fill });
          }}
        />
        <div className="mt-2">
          <NumberField
            label={t('properties.opacity')}
            testId="prop-opacity"
            value={shape.opacity * PERCENT}
            min={0}
            max={PERCENT}
            onCommit={(percent) => {
              actions.restyle(shape.id, { opacity: percent / PERCENT });
            }}
          />
        </div>
      </Section>
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
    </>
  );
}

/** Right-hand panel with the properties of the selected object. */
export function PropertiesPanel() {
  const { t } = useTranslation();
  const selection = useEditorStore((s) => s.selection);
  const model = useEditorStore((s) => s.snapshot.model);
  const selected = selection[0] === undefined ? undefined : findObject(model, selection[0]);

  return (
    <aside
      aria-label={t('properties.title')}
      data-testid="properties-panel"
      className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <h2 className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold dark:border-neutral-700">
        {selected === undefined ? t('properties.title') : t('properties.shape')}
      </h2>
      {selected === undefined ? (
        <div className="space-y-3 p-4 text-sm text-neutral-600 dark:text-neutral-300">
          <p>{t('properties.empty')}</p>
          <p className="text-xs">{t('properties.hint')}</p>
        </div>
      ) : (
        <ShapeProperties key={selected.id} shape={selected} />
      )}
    </aside>
  );
}
