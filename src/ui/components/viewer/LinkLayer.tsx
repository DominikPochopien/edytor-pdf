import { useTranslation } from 'react-i18next';
import type { DocumentId } from '../../../domain/document';
import { usePageLinks } from '../../hooks/usePageData';
import { useViewerStore } from '../../store/viewerStore';

interface LinkLayerProps {
  readonly documentId: DocumentId;
  readonly pageIndex: number;
  readonly zoom: number;
}

/** Clickable link areas. External links never open directly: the user confirms the address first. */
export function LinkLayer({ documentId, pageIndex, zoom }: LinkLayerProps) {
  const { t } = useTranslation();
  const links = usePageLinks(documentId, pageIndex);
  const confirmLink = useViewerStore((s) => s.confirmLink);
  const goToPage = useViewerStore((s) => s.goToPage);

  return (
    <>
      {links.map((link) => {
        const { target, bbox } = link;
        const label =
          target.kind === 'external'
            ? target.uri
            : t('link.toPage', { page: target.pageIndex + 1 });
        return (
          <button
            key={`${bbox.x},${bbox.y},${label}`}
            type="button"
            aria-label={label}
            title={label}
            className="absolute cursor-pointer rounded-sm hover:bg-accent-500/15 focus-visible:bg-accent-500/15"
            style={{
              left: bbox.x * zoom,
              top: bbox.y * zoom,
              width: bbox.width * zoom,
              height: bbox.height * zoom,
            }}
            onClick={() => {
              if (target.kind === 'external') {
                confirmLink(target.uri);
              } else {
                goToPage(target.pageIndex);
              }
            }}
          />
        );
      })}
    </>
  );
}
