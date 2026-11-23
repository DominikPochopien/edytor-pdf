import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

interface ModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly wide?: boolean;
}

/** Accessible dialog (focus trap, Esc to close) built on Radix. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl dark:bg-neutral-800 ${wide ? 'max-w-xl' : 'max-w-md'}`}
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {description === undefined ? (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          ) : (
            <Dialog.Description className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
