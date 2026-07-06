// Length caps and value checks for roster (Player) string fields, mirroring
// the bounds the relay's Zod schemas enforce on the socket side. Applied by
// the player create/update API routes so uncapped/unvalidated values can't
// reach the DB (or be re-served publicly via the graphics roster route).

export const PLAYER_FIELD_MAX = {
  firstName: 100,
  lastName: 100,
  displayName: 100,
  externalId: 100,
  provider: 100,
  bio: 1000,
  photoUrl: 500,
} as const;

export type PlayerField = keyof typeof PLAYER_FIELD_MAX;

// Returns an error message when the (already-trimmed) value is invalid, or
// null when it's acceptable. photoUrl is restricted to a relay-relative
// /player-photos/ path or an https URL so it can't carry a javascript:/data:
// scheme when rendered.
export function validatePlayerField(field: PlayerField, value: string): string | null {
  if (value.length > PLAYER_FIELD_MAX[field]) {
    return `${field} must be at most ${PLAYER_FIELD_MAX[field]} characters`;
  }
  if (field === "photoUrl" && value) {
    const ok = value.startsWith("/player-photos/") || /^https:\/\//i.test(value);
    if (!ok) return "photoUrl must be a /player-photos/ path or an https URL";
  }
  return null;
}
