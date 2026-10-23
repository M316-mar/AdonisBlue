/** Returns the best booking link for a returning client, or null if neither is set. */
export function returnBookingLink(
  rebookingLink: string | null | undefined,
  bookingLink: string | null | undefined
): string | null {
  return rebookingLink?.trim() || bookingLink?.trim() || null;
}
