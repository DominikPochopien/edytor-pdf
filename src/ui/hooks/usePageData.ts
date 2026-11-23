import { useEffect, useState } from 'react';
import type { DocumentId, PageLink, TextLine } from '../../domain/document';
import { logDev } from '../app/devLog';
import { useServices } from '../app/services';

const EMPTY_LINES: readonly TextLine[] = [];
const EMPTY_LINKS: readonly PageLink[] = [];

/** Text lines of a page for the selectable text layer (loaded lazily, when the page is visible). */
export function useTextLines(documentId: DocumentId, pageIndex: number): readonly TextLine[] {
  const { text } = useServices();
  const [lines, setLines] = useState<readonly TextLine[]>(EMPTY_LINES);
  useEffect(() => {
    let active = true;
    text.getTextLines(documentId, pageIndex).then(
      (result) => {
        if (active) {
          setLines(result);
        }
      },
      (error: unknown) => {
        logDev('Cannot read text layer', error);
      },
    );
    return () => {
      active = false;
    };
  }, [text, documentId, pageIndex]);
  return lines;
}

export function usePageLinks(documentId: DocumentId, pageIndex: number): readonly PageLink[] {
  const { text } = useServices();
  const [links, setLinks] = useState<readonly PageLink[]>(EMPTY_LINKS);
  useEffect(() => {
    let active = true;
    text.getLinks(documentId, pageIndex).then(
      (result) => {
        if (active) {
          setLinks(result);
        }
      },
      (error: unknown) => {
        logDev('Cannot read links', error);
      },
    );
    return () => {
      active = false;
    };
  }, [text, documentId, pageIndex]);
  return links;
}
