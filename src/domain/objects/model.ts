import type { EditObject, ObjectId } from './types';

/** All edits of a document, in drawing order (later objects are drawn on top). */
export interface EditModel {
  readonly objects: readonly EditObject[];
}

export const EMPTY_MODEL: EditModel = { objects: [] };

export function findObject(model: EditModel, id: ObjectId): EditObject | undefined {
  return model.objects.find((o) => o.id === id);
}

export function objectsOnPage(model: EditModel, pageIndex: number): readonly EditObject[] {
  return model.objects.filter((o) => o.pageIndex === pageIndex);
}

export function addObjects(model: EditModel, objects: readonly EditObject[]): EditModel {
  return { objects: [...model.objects, ...objects] };
}

/** Inserts objects at given positions (used to undo a removal and restore the stacking order). */
export function insertObjectsAt(
  model: EditModel,
  entries: readonly { readonly object: EditObject; readonly index: number }[],
): EditModel {
  const objects = [...model.objects];
  for (const { object, index } of [...entries].sort((a, b) => a.index - b.index)) {
    objects.splice(Math.min(index, objects.length), 0, object);
  }
  return { objects };
}

export function removeObjects(model: EditModel, ids: readonly ObjectId[]): EditModel {
  const remove = new Set(ids);
  return { objects: model.objects.filter((o) => !remove.has(o.id)) };
}

/** Replaces objects with the same id, keeping their position in the stacking order. */
export function replaceObjects(model: EditModel, updated: readonly EditObject[]): EditModel {
  const byId = new Map(updated.map((o) => [o.id, o]));
  return { objects: model.objects.map((o) => byId.get(o.id) ?? o) };
}

/** Moves an object to another position in the stacking order. */
export function moveObjectToIndex(model: EditModel, id: ObjectId, index: number): EditModel {
  const from = model.objects.findIndex((o) => o.id === id);
  const object = model.objects[from];
  if (object === undefined) {
    return model;
  }
  const objects = model.objects.filter((o) => o.id !== id);
  objects.splice(Math.max(0, Math.min(index, objects.length)), 0, object);
  return { objects };
}
