/** Common Uzbek / Russian / Latin misspellings & synonyms for electronics. */
const SYNONYM_MAP: Record<string, string> = {
  smarton: 'smartfon',
  smartfone: 'smartfon',
  smartphone: 'smartfon',
  смартфон: 'smartfon',
  телефон: 'telefon',
  telephon: 'telefon',
  telефон: 'telefon',
  noutbuk: 'noutbuk',
  notebook: 'noutbuk',
  ноутбук: 'noutbuk',
  laptop: 'noutbuk',
  laptom: 'noutbuk',
  noutbook: 'noutbuk',
  quloqchin: 'quloqchin',
  quloqchinlar: 'quloqchin',
  наушник: 'quloqchin',
  наушники: 'quloqchin',
  naushnik: 'quloqchin',
  naushniki: 'quloqchin',
  earphone: 'quloqchin',
  headphone: 'quloqchin',
  planshet: 'planshet',
  планшет: 'planshet',
  tablet: 'planshet',
  televizor: 'televizor',
  телевизор: 'televizor',
  tv: 'televizor',
  monitor: 'monitor',
  монитор: 'monitor',
  klaviatura: 'klaviatura',
  клавиатура: 'klaviatura',
  keyboard: 'klaviatura',
  sichqoncha: 'sichqoncha',
  мышь: 'sichqoncha',
  mouse: 'sichqoncha',
  zaryadka: 'zaryadka',
  зарядка: 'zaryadka',
  charger: 'zaryadka',
  powerbank: 'powerbank',
  pauerbank: 'powerbank',
  пауэрбанк: 'powerbank',
  iphon: 'iphone',
  ayfon: 'iphone',
  айфон: 'iphone',
  samsun: 'samsung',
  самсунг: 'samsung',
  xiaom: 'xiaomi',
  сяоми: 'xiaomi',
  redmi: 'redmi',
  macbok: 'macbook',
  makbook: 'macbook',
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-яўқғҳʼ'\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSearchQuery(value: string): string[] {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 0);
}

export function applySynonyms(tokens: string[]): string[] {
  return tokens.map((token) => SYNONYM_MAP[token] ?? token);
}

/** Damerau–Levenshtein distance (insert/delete/substitute/transpose). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return Math.max(m, n);

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + cost);
      }
    }
  }
  return dp[m]![n]!;
}

export function maxEditDistanceForToken(token: string): number {
  if (token.length <= 3) return 1;
  if (token.length <= 6) return 2;
  return 3;
}

export function correctTokenAgainstVocabulary(
  token: string,
  vocabulary: Iterable<string>,
): { token: string; corrected: boolean; distance: number } {
  const synonym = SYNONYM_MAP[token];
  if (synonym && synonym !== token) {
    return { token: synonym, corrected: true, distance: 0 };
  }

  let best = token;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestScore = Number.NEGATIVE_INFINITY;
  const maxDist = maxEditDistanceForToken(token);

  for (const candidate of vocabulary) {
    if (candidate === token) {
      return { token, corrected: false, distance: 0 };
    }
    if (Math.abs(candidate.length - token.length) > maxDist) continue;
    // Skip SKU-like tokens (digits) for typo correction.
    if (/\d/.test(candidate)) continue;

    const distance = editDistance(token, candidate);
    if (distance > maxDist) continue;

    let score = -distance * 10;
    if (candidate.startsWith(token) || token.startsWith(candidate)) {
      score += 5;
    }
    if (candidate.includes(token) || token.includes(candidate)) {
      score += 2;
    }
    // Prefer natural word length over tiny fragments.
    score += Math.min(candidate.length, 12) * 0.1;

    if (
      distance < bestDistance ||
      (distance === bestDistance && score > bestScore)
    ) {
      bestDistance = distance;
      bestScore = score;
      best = candidate;
    }
  }

  if (bestDistance <= maxDist && best !== token) {
    return { token: best, corrected: true, distance: bestDistance };
  }
  return { token, corrected: false, distance: 0 };
}

export function buildCorrectedQuery(
  rawQuery: string,
  vocabulary: Iterable<string>,
): {
  original: string;
  corrected: string;
  wasCorrected: boolean;
  tokens: string[];
} {
  const original = rawQuery.trim();
  const tokens = tokenizeSearchQuery(original);
  if (tokens.length === 0) {
    return { original, corrected: '', wasCorrected: false, tokens: [] };
  }

  let wasCorrected = false;
  const correctedTokens = tokens.map((token) => {
    const result = correctTokenAgainstVocabulary(token, vocabulary);
    if (result.corrected) wasCorrected = true;
    return result.token;
  });

  const withSynonyms = applySynonyms(correctedTokens);
  if (withSynonyms.some((t, i) => t !== correctedTokens[i])) {
    wasCorrected = true;
  }

  return {
    original,
    corrected: withSynonyms.join(' '),
    wasCorrected: wasCorrected || withSynonyms.join(' ') !== tokens.join(' '),
    tokens: withSynonyms,
  };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
