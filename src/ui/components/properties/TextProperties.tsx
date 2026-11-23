import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextAlign, TextObject, TextStyle } from '../../../domain/objects';
import { useServices } from '../../app/services';
import { useEditorActions } from '../../hooks/useEditorActions';
import { NumberField } from '../common/NumberField';
import { FontPicker } from './FontPicker';
import { ArrangeSection, ColorRow, GeometrySection, Section } from './sections';

const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 400;
const MIN_LINE_HEIGHT = 0.5;
const MAX_LINE_HEIGHT = 4;
const LINE_HEIGHT_STEP = 0.05;

function Toggle({
  label,
  pressed,
  disabled = false,
  onClick,
  children,
}: {
  readonly label: string;
  readonly pressed: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-md border border-neutral-300 hover:bg-neutral-100 disabled:opacity-40 aria-pressed:border-accent-500 aria-pressed:bg-accent-100 aria-pressed:text-accent-700 dark:border-neutral-600 dark:hover:bg-neutral-700 dark:aria-pressed:bg-accent-700/40 dark:aria-pressed:text-white"
    >
      {children}
    </button>
  );
}

const ALIGNMENTS: readonly {
  value: TextAlign;
  icon: ReactNode;
  label: 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify';
}[] = [
  { value: 'left', icon: <AlignLeft aria-hidden className="size-4" />, label: 'alignLeft' },
  { value: 'center', icon: <AlignCenter aria-hidden className="size-4" />, label: 'alignCenter' },
  { value: 'right', icon: <AlignRight aria-hidden className="size-4" />, label: 'alignRight' },
  {
    value: 'justify',
    icon: <AlignJustify aria-hidden className="size-4" />,
    label: 'alignJustify',
  },
];

export function TextProperties({ text }: { readonly text: TextObject }) {
  const { t } = useTranslation();
  const actions = useEditorActions();
  const { fonts } = useServices();
  const { style } = text;
  const family = fonts.family(style.fontFamily);
  const hasBold = family?.styles.includes('bold') ?? false;
  const hasItalic = family?.styles.includes('italic') ?? false;
  const change = (patch: Partial<TextStyle>): void => {
    void actions.changeText(text.id, { style: patch });
  };

  return (
    <>
      <p className="px-4 pt-3 text-xs text-neutral-600 dark:text-neutral-300">
        {t('properties.textHint')}
      </p>
      <Section title={t('properties.text')}>
        <FontPicker
          value={style.fontFamily}
          onChange={(fontFamily) => {
            change({ fontFamily });
          }}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label={t('properties.fontSize')}
            testId="prop-font-size"
            value={style.fontSize}
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            onCommit={(fontSize) => {
              change({ fontSize });
            }}
          />
          <NumberField
            label={t('properties.lineHeight')}
            testId="prop-line-height"
            value={style.lineHeight}
            min={MIN_LINE_HEIGHT}
            max={MAX_LINE_HEIGHT}
            step={LINE_HEIGHT_STEP}
            onCommit={(lineHeight) => {
              change({ lineHeight });
            }}
          />
        </div>
        <div className="mt-3">
          <ColorRow
            label={t('properties.textColor')}
            value={style.color}
            fallback="#000000"
            testId="prop-text-color"
            onChange={(color) => {
              change({ color: color ?? '#000000' });
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label={t('properties.text')}>
          <Toggle
            label={t('properties.bold')}
            pressed={style.bold}
            disabled={!hasBold}
            onClick={() => {
              change({ bold: !style.bold });
            }}
          >
            <Bold aria-hidden className="size-4" />
          </Toggle>
          <Toggle
            label={t('properties.italic')}
            pressed={style.italic}
            disabled={!hasItalic}
            onClick={() => {
              change({ italic: !style.italic });
            }}
          >
            <Italic aria-hidden className="size-4" />
          </Toggle>
          <Toggle
            label={t('properties.underline')}
            pressed={style.underline}
            onClick={() => {
              change({ underline: !style.underline });
            }}
          >
            <Underline aria-hidden className="size-4" />
          </Toggle>
          <span aria-hidden className="mx-1 w-px bg-neutral-200 dark:bg-neutral-700" />
          {ALIGNMENTS.map((alignment) => (
            <Toggle
              key={alignment.value}
              label={t(`properties.${alignment.label}`)}
              pressed={style.align === alignment.value}
              onClick={() => {
                change({ align: alignment.value });
              }}
            >
              {alignment.icon}
            </Toggle>
          ))}
        </div>
        {(!hasBold || !hasItalic) && (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('properties.styleMissing')}
          </p>
        )}
      </Section>
      <GeometrySection
        object={text}
        onWidth={(width) => {
          void actions.changeText(text.id, { width });
        }}
      />
      <ArrangeSection />
    </>
  );
}
