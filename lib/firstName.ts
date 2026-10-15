/** Returns the first word of a name for client-facing greetings. "Tina Farias" → "Tina" */
export function firstName(name: string | null | undefined, fallback: string): string {
  if (!name?.trim()) return fallback;
  return name.trim().split(/\s+/)[0];
}
