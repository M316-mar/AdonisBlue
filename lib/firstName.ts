/**
 * Returns the first word of a name, capitalized, for client-facing greetings.
 * "tina farias" → "Tina"  |  "maria jose" → "Maria"  |  "MARIA" → "Maria"
 */
export function firstName(name: string | null | undefined, fallback: string): string {
  if (!name?.trim()) return fallback;
  const word = name.trim().split(/\s+/)[0]!;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
