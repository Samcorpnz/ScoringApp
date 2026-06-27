export function parseClock(input: string): number | null {
  const trimmed = input.trim();
  // Accept MM:SS or plain seconds
  const colonMatch = trimmed.match(/^(\d{1,3}):(\d{2})$/);
  if (colonMatch) return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  const seconds = parseInt(trimmed, 10);
  if (!isNaN(seconds) && seconds >= 0) return seconds;
  return null;
}
