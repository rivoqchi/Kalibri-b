/**
 * Normalize MONGODB_URI from env (Render paste mistakes: KEY=value, quotes, BOM).
 * Does not log secrets — use redactMongoUriForLog for any preview.
 */
export function sanitizeMongoUri(raw: string | undefined | null): string {
  if (raw == null) return '';

  let v = String(raw)
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  v = stripSurroundingQuotes(v);

  if (/^MONGODB_URI\s*=/i.test(v)) {
    v = v.replace(/^MONGODB_URI\s*=\s*/i, '').trim();
    v = stripSurroundingQuotes(v);
  }

  return v;
}

function stripSurroundingQuotes(value: string): string {
  let v = value;
  while (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** For logs only — replace ://user:pass@ with ://***:***@. */
export function redactMongoUriForLog(uri: string): string {
  return uri.replace(/:\/\/[^/@]+@/, '://***:***@');
}
