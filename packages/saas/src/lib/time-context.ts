/**
 * Generates a current time/date context string to inject into advisor prompts.
 * Without this, models fall back to training-data dates which are always wrong.
 */
export function getCurrentTimeContext(): string {
  const now = new Date();

  const utcString = now.toUTCString(); // e.g. "Fri, 08 May 2026 20:56:00 GMT"
  const iso = now.toISOString();       // e.g. "2026-05-08T20:56:00.000Z"

  const weekday = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });

  return (
    `[Current Date & Time]\n` +
    `Today is ${dateStr}, ${timeStr} UTC (ISO: ${iso}).\n` +
    `Use this as the authoritative current time for any scheduling, deadline, or date calculations.`
  );
}
