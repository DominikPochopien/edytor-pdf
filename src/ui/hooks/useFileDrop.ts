import { useEffect, useState } from 'react';
import { useDocumentActions } from './useDocumentActions';

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

function firstPdf(files: FileList | undefined): File | undefined {
  if (files === undefined) {
    return undefined;
  }
  const list = Array.from(files);
  return (
    list.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) ??
    list[0]
  );
}

/** Lets the user drop a PDF anywhere in the window. Returns true while a file is dragged over. */
export function useFileDrop(): boolean {
  const { openFile } = useDocumentActions();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;
    const onEnter = (event: DragEvent): void => {
      if (hasFiles(event)) {
        depth += 1;
        setDragging(true);
      }
    };
    const onLeave = (event: DragEvent): void => {
      if (hasFiles(event)) {
        depth = Math.max(0, depth - 1);
        if (depth === 0) {
          setDragging(false);
        }
      }
    };
    const onOver = (event: DragEvent): void => {
      if (hasFiles(event)) {
        event.preventDefault();
        if (event.dataTransfer !== null) {
          event.dataTransfer.dropEffect = 'copy';
        }
      }
    };
    const onDrop = (event: DragEvent): void => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = firstPdf(event.dataTransfer?.files);
      if (file !== undefined) {
        void openFile(file);
      }
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [openFile]);

  return dragging;
}
