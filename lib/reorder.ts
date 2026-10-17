/** Move one list item from `from` to `to`. Returns the same array when the move is a no-op. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Replace the members of `group` inside `all` with `nextGroup`, keeping every
 * other item in place. Group membership is by `id`.
 */
export function applyGroupReorder<T extends { id: number }>(
  all: T[],
  group: T[],
  nextGroup: T[]
): T[] {
  const ids = new Set(group.map((item) => item.id));
  const queue = nextGroup.slice();
  return all.map((item) => (ids.has(item.id) ? queue.shift() ?? item : item));
}
