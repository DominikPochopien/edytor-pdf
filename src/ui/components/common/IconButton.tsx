import * as Tooltip from '@radix-ui/react-tooltip';
import type { ComponentPropsWithRef, ReactNode } from 'react';

interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  readonly label: string;
  readonly shortcut?: string;
  readonly icon: ReactNode;
  readonly active?: boolean;
}

/** Toolbar button with an accessible name and a tooltip showing the label and shortcut. */
export function IconButton({
  label,
  shortcut,
  icon,
  active = false,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          data-active={active}
          className={`inline-flex size-9 items-center justify-center rounded-md text-neutral-700 transition-colors hover:bg-neutral-200 disabled:pointer-events-none disabled:opacity-40 data-[active=true]:bg-accent-100 data-[active=true]:text-accent-700 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:data-[active=true]:bg-accent-700/40 dark:data-[active=true]:text-accent-100 ${className}`}
          {...rest}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={6}
          className="z-50 rounded-md bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
        >
          {label}
          {shortcut !== undefined && <kbd className="ml-2 font-sans opacity-70">{shortcut}</kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
