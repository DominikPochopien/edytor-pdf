import type { EditModel, EditObject, ObjectId } from '../../domain/objects';
import {
  addObjects,
  insertObjectsAt,
  moveObjectToIndex,
  removeObjects,
  replaceObjects,
} from '../../domain/objects';
import type { Command, CommandLabel } from './Command';

export class AddObjectsCommand implements Command {
  constructor(
    private readonly objects: readonly EditObject[],
    readonly label: CommandLabel = 'add',
  ) {}

  apply(model: EditModel): EditModel {
    return addObjects(model, this.objects);
  }

  revert(model: EditModel): EditModel {
    return removeObjects(
      model,
      this.objects.map((o) => o.id),
    );
  }
}

export class RemoveObjectsCommand implements Command {
  readonly label = 'remove';
  private readonly entries: readonly { readonly object: EditObject; readonly index: number }[];

  /** Remembers where each object was in the stacking order, so Undo restores it exactly. */
  constructor(model: EditModel, ids: readonly ObjectId[]) {
    const remove = new Set(ids);
    this.entries = model.objects
      .map((object, index) => ({ object, index }))
      .filter(({ object }) => remove.has(object.id));
  }

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  apply(model: EditModel): EditModel {
    return removeObjects(
      model,
      this.entries.map((e) => e.object.id),
    );
  }

  revert(model: EditModel): EditModel {
    return insertObjectsAt(model, this.entries);
  }
}

/**
 * Replaces objects by new versions (moved, resized, recoloured…). With a `mergeKey`, consecutive
 * updates of the same objects within `mergeWindowMs` become one Undo step.
 */
export class UpdateObjectsCommand implements Command {
  constructor(
    readonly before: readonly EditObject[],
    readonly after: readonly EditObject[],
    readonly label: CommandLabel,
    private readonly merge?: {
      readonly key: string;
      readonly at: number;
      readonly windowMs: number;
    },
  ) {}

  apply(model: EditModel): EditModel {
    return replaceObjects(model, this.after);
  }

  revert(model: EditModel): EditModel {
    return replaceObjects(model, this.before);
  }

  mergeWith(next: Command): Command | null {
    if (!(next instanceof UpdateObjectsCommand)) {
      return null;
    }
    const mine = this.merge;
    const theirs = next.merge;
    if (mine === undefined || theirs === undefined) {
      return null;
    }
    const mergeable =
      theirs.key === mine.key &&
      theirs.at - mine.at <= mine.windowMs &&
      sameIds(this.after, next.before);
    return mergeable ? new UpdateObjectsCommand(this.before, next.after, this.label, theirs) : null;
  }
}

function sameIds(a: readonly EditObject[], b: readonly EditObject[]): boolean {
  return a.length === b.length && a.every((o, i) => o.id === b[i]?.id);
}

export class ReorderObjectCommand implements Command {
  readonly label = 'reorder';

  constructor(
    private readonly id: ObjectId,
    private readonly from: number,
    private readonly to: number,
  ) {}

  apply(model: EditModel): EditModel {
    return moveObjectToIndex(model, this.id, this.to);
  }

  revert(model: EditModel): EditModel {
    return moveObjectToIndex(model, this.id, this.from);
  }
}
