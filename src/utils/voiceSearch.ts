/**
 * Voice Search Helper for Portuguese (pt-BR)
 * Cleans spoken transcripts to extract order numbers, telephone digits, or client names.
 */

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

const PT_WORDS_TO_NUM: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  meia: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezasseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
  mil: 1000
};

/**
 * Tries to convert spoken Portuguese compound numbers like "quarenta e dois" or "cento e cinquenta"
 */
function parseSpokenPortugueseNumber(raw: string): number | null {
  const words = raw.toLowerCase().trim().split(/\s+/).filter(w => w !== 'e' && w !== '');
  if (words.length === 0) return null;

  let total = 0;
  let currentGroup = 0;
  let hasNumber = false;

  for (const word of words) {
    if (PT_WORDS_TO_NUM[word] !== undefined) {
      hasNumber = true;
      const val = PT_WORDS_TO_NUM[word];
      if (val === 1000) {
        currentGroup = (currentGroup === 0 ? 1 : currentGroup) * 1000;
        total += currentGroup;
        currentGroup = 0;
      } else {
        currentGroup += val;
      }
    } else {
      return null;
    }
  }

  total += currentGroup;
  return hasNumber ? total : null;
}

/**
 * Tries to parse a sequence of spoken digits (e.g. "nove oito oito sete...") into a telephone number string
 */
function parseSpokenDigitSequence(raw: string): string | null {
  const words = raw.toLowerCase().trim().split(/\s+/).filter(w => w !== '');
  if (words.length < 5) return null; // Likely not a phone number sequence

  let digits = '';
  for (const word of words) {
    if (PT_WORDS_TO_NUM[word] !== undefined && PT_WORDS_TO_NUM[word] <= 9) {
      digits += PT_WORDS_TO_NUM[word];
    } else if (/^\d+$/.test(word)) {
      digits += word;
    } else {
      return null;
    }
  }

  return digits.length >= 8 ? digits : null;
}

/**
 * Cleans the voice recognition transcript:
 * 1. Strips punctuation (#, ?, !, etc.)
 * 2. Removes prefix intents ("pedido", "número", "ver pedido", etc.)
 * 3. Converts spoken numbers into pure digits if applicable
 * 4. Cleans spaces between digit groups for phone searches
 */
export function cleanVoiceSearchTranscript(transcript: string): string {
  if (!transcript) return '';

  let cleaned = transcript
    .trim()
    .replace(/[#.,;:!?'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common speech filler prefixes (case insensitive)
  const prefixes = [
    /^(?:por\s+favor\s+)?(?:ver|abrir|buscar|pesquisar|entregar|encontrar|pegar)?\s*(?:o\s+)?(?:pedido|encomenda)\s*(?:de\s+número|número|numero|nº|código|codigo)?\s*(?:de\s+)?/i,
    /^(?:número|numero|nº|codigo|código|jogo\s+da\s+velha|hashtag|cerquilha)\s+/i,
    /^(?:cliente|pra|para|nome)\s+/i
  ];

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '').trim();
  }

  // Check if speech is a sequence of spoken phone digits (e.g. "nove oito sete...")
  const phoneDigits = parseSpokenDigitSequence(cleaned);
  if (phoneDigits) {
    return phoneDigits;
  }

  // Check if speech is written-out Portuguese numbers (e.g. "quarenta e dois")
  const spokenNum = parseSpokenPortugueseNumber(cleaned);
  if (spokenNum !== null) {
    return String(spokenNum);
  }

  // If already contains spaced digits like "9 8 8 7 7 6 6 5 5" or "4 2"
  const spacedDigits = cleaned.replace(/\s+/g, '');
  if (/^\d+$/.test(spacedDigits)) {
    return spacedDigits;
  }

  return cleaned;
}
