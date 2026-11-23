import { useTranslation } from 'react-i18next';
import type { HexColor, ShapeObject } from '../../../domain/objects';
import { useEditorActions } from '../../hooks/useEditorActions';
import { NumberField } from '../common/NumberField';
import { ArrangeSection, ColorRow, GeometrySection, Section } from './sections';

const PERCENT = 100;
const MAX_STROKE_WIDTH = 72;
const DEFAULT_FILL: HexColor = '#fde68a';
const DEFAULT_STROKE: HexColor = '#dc2626';

export function ShapeProperties({ shape }: { readonly shape: ShapeObject }) {
  const { t } = useTranslation();
  const actions = useEditorActions();

  return (
    <>
      <GeometrySection object={shape} />
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
      <ArrangeSection />
    </>
  );
}
