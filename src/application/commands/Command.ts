import type { EditModel } from '../../domain/objects';

/** Names of operations, shown in tooltips such as "Cofnij: przesunięcie" (key in i18n "history.*"). */
export type CommandLabel =
  | 'add'
  | 'remove'
  | 'move'
  | 'transform'
  | 'style'
  | 'reorder'
  | 'paste'
  | 'duplicate'
  | 'edit-text';

/** One undoable change of the edit model. Commands are immutable and never touch the UI. */
export interface Command {
  readonly label: CommandLabel;
  apply(model: EditModel): EditModel;
  revert(model: EditModel): EditModel;
  /**
   * Optionally absorbs the next command into this one (e.g. several arrow-key nudges in a row),
   * so that a single Undo reverts all of them. Returns null when the commands cannot merge.
   */
  mergeWith?(next: Command): Command | null;
}
