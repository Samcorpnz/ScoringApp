const CLOCK_PATTERN = /^(\d{1,3}):(\d{2})$/;

export function parseClock(input: string): number | null {
  const trimmed = input.trim();
  // Accept MM:SS or plain seconds
  const colonMatch = CLOCK_PATTERN.exec(trimmed);
  if (colonMatch) return Number.parseInt(colonMatch[1], 10) * 60 + Number.parseInt(colonMatch[2], 10);
  const seconds = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds;
  return null;
}
