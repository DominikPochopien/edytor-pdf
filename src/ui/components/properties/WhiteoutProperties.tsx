import { Pipette, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_WHITEOUT_COLOR } from '../../../application/use-cases';
import type { WhiteoutRect } from '../../../domain/objects';
import { useEditorActions } from '../../hooks/useEditorActions';
import { useEditorStore } from '../../store/editorStore';
import { actionButton, ArrangeSection, ColorRow, GeometrySection, Section } from './sections';

export function WhiteoutProperties({ whiteout }: { readonly whiteout: WhiteoutRect }) {
  const { t } = useTranslation();
  const actions = useEditorActions();
  const picking = useEditorStore((s) => s.tool === 'eyedropper' && s.pickTarget === whiteout.id);
  const startPicking = useEditorStore((s) => s.startPicking);

  return (
    <>
      <p
        role="note"
        data-testid="whiteout-warning"
        className="m-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-900/30 dark:text-amber-100"
      >
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        {t('properties.whiteoutWarning')}
      </p>
      <Section title={t('properties.whiteoutColor')}>
        <ColorRow
          label={t('properties.whiteoutColor')}
          value={whiteout.color}
          fallback={DEFAULT_WHITEOUT_COLOR}
          testId="prop-whiteout-color"
          onChange={(color) => {
            actions.restyle(whiteout.id, { color: color ?? DEFAULT_WHITEOUT_COLOR });
          }}
        >
          <button
            type="button"
            aria-pressed={picking}
            className={`${actionButton} aria-pressed:bg-accent-100 aria-pressed:text-accent-700`}
            onClick={() => {
              if (picking) {
                actions.setTool('select');
              } else {
                startPicking(whiteout.id);
              }
            }}
          >
            <Pipette aria-hidden className="size-4" />
            {t('toolbar.toolEyedropper')}
          </button>
        </ColorRow>
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300" aria-live="polite">
          {picking ? t('properties.pickHint') : t('properties.pickColor')}
        </p>
      </Section>
      <GeometrySection object={whiteout} />
      <ArrangeSection />
    </>
  );
}
