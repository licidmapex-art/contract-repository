/** 2.0 models have no free-tier quota in many EU regions — do not fall back to them. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function parseGeminiApiKeysFromEnv(env: {
  GEMINI_API_KEY?: string;
  GEMINI_API_KEYS?: string;
}): string[] {
  const keys: string[] = [];

  const single = env.GEMINI_API_KEY?.trim();
  if (single) keys.push(single);

  const multiple = env.GEMINI_API_KEYS;
  if (multiple) {
    for (const part of multiple.split(/[,\n]+/)) {
      const trimmed = part.trim();
      if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
    }
  }

  return keys;
}

export function isGeminiQuotaError(message: string): boolean {
  return /429|quota|too many requests|resource.?exhausted|rate limit|exceeded your current/i.test(
    message
  );
}
