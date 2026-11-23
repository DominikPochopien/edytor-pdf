import { useTranslation } from 'react-i18next';
import type { EditObject } from '../../../domain/objects';
import { findObject } from '../../../domain/objects';
import { useEditorStore } from '../../store/editorStore';
import { ShapeProperties } from './ShapeProperties';
import { TextProperties } from './TextProperties';
import { WhiteoutProperties } from './WhiteoutProperties';

function titleKey(
  object: EditObject,
): 'properties.shape' | 'properties.text' | 'properties.whiteout' {
  switch (object.kind) {
    case 'shape':
      return 'properties.shape';
    case 'text':
      return 'properties.text';
    case 'whiteout':
      return 'properties.whiteout';
  }
}

function ObjectProperties({ object }: { readonly object: EditObject }) {
  switch (object.kind) {
    case 'shape':
      return <ShapeProperties shape={object} />;
    case 'text':
      return <TextProperties text={object} />;
    case 'whiteout':
      return <WhiteoutProperties whiteout={object} />;
  }
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
        {selected === undefined ? t('properties.title') : t(titleKey(selected))}
      </h2>
      {selected === undefined ? (
        <div className="space-y-3 p-4 text-sm text-neutral-600 dark:text-neutral-300">
          <p>{t('properties.empty')}</p>
          <p className="text-xs">{t('properties.hint')}</p>
        </div>
      ) : (
        <ObjectProperties key={selected.id} object={selected} />
      )}
    </aside>
  );
}
