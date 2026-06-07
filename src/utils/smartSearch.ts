// Greek accent normalization + Greeklish transliteration for smart search

const ACCENT_MAP: Record<string, string> = {
  'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
  'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ',
  'Ά': 'α', 'Έ': 'ε', 'Ή': 'η', 'Ί': 'ι', 'Ό': 'ο', 'Ύ': 'υ', 'Ώ': 'ω',
  'Ϊ': 'ι', 'Ϋ': 'υ',
};

const GREEKLISH_MAP: Record<string, string> = {
  'α': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z',
  'η': 'i', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm',
  'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's',
  'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'x', 'ψ': 'ps',
  'ω': 'o',
};

function normalizeGreek(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map(ch => ACCENT_MAP[ch] ?? ch)
    .join('')
    .replace(/ς/g, 'σ');
}

function toGreeklish(text: string): string {
  return normalizeGreek(text)
    .split('')
    .map(ch => GREEKLISH_MAP[ch] ?? ch)
    .join('');
}

export function smartMatch(text: string, query: string): boolean {
  if (!text || !query) return false;
  const q = query.toLowerCase().trim();
  if (!q) return false;

  // 1. Direct (case-insensitive)
  if (text.toLowerCase().includes(q)) return true;

  // 2. Accent-insensitive Greek
  const normText = normalizeGreek(text);
  const normQuery = normalizeGreek(q);
  if (normText.includes(normQuery)) return true;

  // 3. Greeklish (Latin query against Greek text)
  const greeklishText = toGreeklish(text);
  if (greeklishText.includes(q)) return true;

  return false;
}

export function smartSearchCustomers<T extends {
  name?: string;
  code?: string;
  city?: string;
  area?: string;
  afm?: string;
}>(customers: T[], query: string): T[] {
  if (!query.trim()) return customers;

  // Numeric input → exact code match first, then prefix, then full search
  if (/^\d+$/.test(query.trim())) {
    const exactMatch = customers.filter(c => c.code === query.trim());
    if (exactMatch.length > 0) return exactMatch;
    const prefixMatch = customers.filter(c => c.code?.startsWith(query.trim()));
    if (prefixMatch.length > 0) return prefixMatch;
  }

  return customers.filter(c =>
    smartMatch(c.name ?? '', query) ||
    smartMatch(c.code ?? '', query) ||
    smartMatch(c.city ?? '', query) ||
    smartMatch(c.area ?? '', query) ||
    smartMatch(c.afm ?? '', query)
  );
}
