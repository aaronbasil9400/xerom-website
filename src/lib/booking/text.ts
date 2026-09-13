/**
 * Calendar descriptions are staff-facing plain text. Remove control characters
 * and delimiters so customer input cannot forge structured lines in an event.
 */
export function sanitizeCalendarText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[|]/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}
