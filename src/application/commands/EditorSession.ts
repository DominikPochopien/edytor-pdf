import type { EditModel } from '../../domain/objects';
import { EMPTY_MODEL } from '../../domain/objects';
import type { Command, CommandLabel } from './Command';

/** Undo steps kept in memory. Older steps are dropped. */
export const MAX_HISTORY = 200;

export interface EditorSnapshot {
  readonly model: EditModel;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel: CommandLabel | null;
  readonly redoLabel: CommandLabel | null;
  /** True when there are changes since opening or the last save. */
  readonly dirty: boolean;
}

type Listener = (snapshot: EditorSnapshot) => void;

/**
 * The edit model of the open document together with its Undo/Redo history (Command pattern).
 * Every change goes through `execute`, so every change can be undone.
 */
export class EditorSession {
  private model: EditModel = EMPTY_MODEL;
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  /** Changes since the last save; the document is clean when this is 0. */
  private changesSinceSave = 0;
  /** Set when the saved state was undone past and can no longer be reached by undo/redo. */
  private savedStateLost = false;
  private readonly listeners = new Set<Listener>();
  private lastSnapshot: EditorSnapshot;

  constructor() {
    this.lastSnapshot = this.createSnapshot();
  }

  get snapshot(): EditorSnapshot {
    return this.lastSnapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  execute(command: Command): void {
    const previous = this.undoStack.at(-1);
    const merged = previous?.mergeWith?.(command) ?? null;
    this.model = command.apply(this.model);
    if (merged !== null && this.changesSinceSave !== 0) {
      this.undoStack[this.undoStack.length - 1] = merged;
    } else {
      this.undoStack.push(command);
      this.trackChange(1);
      if (this.undoStack.length > MAX_HISTORY) {
        this.undoStack.shift();
      }
    }
    if (this.redoStack.length > 0 && this.changesSinceSave <= 0) {
      // The saved state was in the redo stack and is now unreachable.
      this.savedStateLost = true;
    }
    this.redoStack = [];
    this.emit();
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (command === undefined) {
      return;
    }
    this.model = command.revert(this.model);
    this.redoStack.push(command);
    this.trackChange(-1);
    this.emit();
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (command === undefined) {
      return;
    }
    this.model = command.apply(this.model);
    this.undoStack.push(command);
    this.trackChange(1);
    this.emit();
  }

  markSaved(): void {
    this.changesSinceSave = 0;
    this.savedStateLost = false;
    this.emit();
  }

  /** Starts over with an empty model (a new document was opened). */
  reset(): void {
    this.model = EMPTY_MODEL;
    this.undoStack = [];
    this.redoStack = [];
    this.changesSinceSave = 0;
    this.savedStateLost = false;
    this.emit();
  }

  private trackChange(delta: number): void {
    this.changesSinceSave += delta;
  }

  private createSnapshot(): EditorSnapshot {
    return {
      model: this.model,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoLabel: this.undoStack.at(-1)?.label ?? null,
      redoLabel: this.redoStack.at(-1)?.label ?? null,
      dirty: this.changesSinceSave !== 0 || this.savedStateLost,
    };
  }

  private emit(): void {
    this.lastSnapshot = this.createSnapshot();
    for (const listener of this.listeners) {
      listener(this.lastSnapshot);
    }
  }
}
