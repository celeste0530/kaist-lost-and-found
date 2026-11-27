// Approximate center of the KAIST main campus (lat, lng).
export const KAIST_CENTER: [number, number] = [36.3721, 127.3604];

// FR-03 "the found date cannot be in the future": "today" is the date on campus (Korea),
// whatever time zone the visitor's browser is set to. Same rule as the server.
export function todayInKorea(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// SRS 3.1 / FR-03: one JPG or PNG image, up to 10 MB.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Returns a message explaining why the file cannot be uploaded, or null when it is fine. */
export function imageProblem(file: File): string | null {
  if (file.type !== "image/jpeg" && file.type !== "image/png") return "Only JPG or PNG images are allowed.";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 10 MB or smaller.";
  return null;
}

/** Empty or whitespace-only text becomes null (optional fields are sent as null, not ""). */
export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
