/** "Dylan R." → "DR" — what avatars show when there's no photo. */
export function initialsFor(name: string): string {
  // Skip words that don't start with a letter/number, so "Taylor (closer)"
  // gives "T", not "T(".
  return name
    .split(" ")
    .filter((part) => /^[\p{L}\p{N}]/u.test(part))
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
