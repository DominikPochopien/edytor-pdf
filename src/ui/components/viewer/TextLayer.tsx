import { useMemo } from 'react';
import type { DocumentId } from '../../../domain/document';
import { useTextLines } from '../../hooks/usePageData';
import { measureTextWidth } from './textMeasure';

interface TextLayerProps {
  readonly documentId: DocumentId;
  readonly pageIndex: number;
  readonly zoom: number;
}

/**
 * Invisible text placed exactly over the rendered page, so the user can select and copy it.
 * Each line is stretched horizontally to match the width it has in the PDF.
 */
export function TextLayer({ documentId, pageIndex, zoom }: TextLayerProps) {
  const lines = useTextLines(documentId, pageIndex);
  const prepared = useMemo(
    () =>
      lines
        .filter((line) => !line.vertical && line.fontSize > 0)
        .map((line) => {
          const natural =
            measureTextWidth(line.text, line.fontFamily, line.bold, line.italic) * line.fontSize;
          return { line, stretch: natural > 0 ? line.bbox.width / natural : 1 };
        }),
    [lines],
  );

  return (
    <div className="text-layer" data-testid="text-layer">
      {prepared.map(({ line, stretch }, i) => (
        <span
          // Lines have no stable id; their order on a page never changes.
          // eslint-disable-next-line @eslint-react/no-array-index-key
          key={i}
          style={{
            left: line.bbox.x * zoom,
            top: line.bbox.y * zoom,
            height: line.bbox.height * zoom,
            fontSize: line.fontSize * zoom,
            lineHeight: `${line.bbox.height * zoom}px`,
            fontFamily: line.fontFamily,
            fontWeight: line.bold ? 'bold' : 'normal',
            fontStyle: line.italic ? 'italic' : 'normal',
            transform: `scaleX(${stretch})`,
          }}
        >
          {line.text}
        </span>
      ))}
    </div>
  );
}
