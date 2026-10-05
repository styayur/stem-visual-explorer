/** Bounded Damerau distance: one insertion/deletion/substitution/adjacent transposition. */
export function oneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length <= 3 || b.length <= 3 || Math.abs(a.length - b.length) > 1)
    return false;
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  if (a.length === b.length) {
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] &&
        a[i + 1] === b[i] &&
        a.slice(i + 2) === b.slice(i + 2))
    );
  }
  return a.length > b.length
    ? a.slice(i + 1) === b.slice(i)
    : a.slice(i) === b.slice(i + 1);
}
