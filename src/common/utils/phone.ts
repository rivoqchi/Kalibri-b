/** Normalize Uzbek/international phone to +998XXXXXXXXX when possible. */
export function normalizePhone(input?: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+998${digits}`;
  }
  if (digits.length === 13 && digits.startsWith('998')) {
    return `+${digits.slice(0, 12)}`;
  }
  return `+${digits}`;
}

export function phonesMatch(a?: string | null, b?: string | null): boolean {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  return Boolean(left && right && left === right);
}
