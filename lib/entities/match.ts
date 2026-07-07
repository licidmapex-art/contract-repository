export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitPartyNames(text: string): string[] {
  return text
    .split(/[,;]|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

export function nameSimilarity(a: string, b: string): number {
  const left = normalizeEntityName(a);
  const right = normalizeEntityName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  if (left.includes(right) || right.includes(left)) {
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    return 0.88 + (shorter / longer) * 0.12;
  }

  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token));
  const tokenScore =
    shared.length / Math.max(leftTokens.size, rightTokens.size, 1);

  const distance = levenshtein(left, right);
  const maxLen = Math.max(left.length, right.length);
  const editScore = maxLen === 0 ? 1 : 1 - distance / maxLen;

  return Math.max(tokenScore * 0.95, editScore);
}

const FUZZY_MATCH_THRESHOLD = 0.82;

export function findBestEntityMatch<T extends { id: string; name: string }>(
  text: string | null | undefined,
  entities: T[],
  threshold = FUZZY_MATCH_THRESHOLD
): T | null {
  if (!text?.trim() || !entities.length) return null;

  let best: { entity: T; score: number } | null = null;

  for (const candidate of [text, ...splitPartyNames(text)]) {
    const normalized = normalizeEntityName(candidate);
    if (!normalized) continue;

    for (const entity of entities) {
      const score = nameSimilarity(candidate, entity.name);
      if (score >= threshold && (!best || score > best.score)) {
        best = { entity, score };
      }
    }
  }

  return best?.entity ?? null;
}

/** @deprecated Use findBestEntityMatch */
export function findEntityMatch<T extends { id: string; name: string }>(
  text: string | null | undefined,
  entities: T[]
): T | null {
  return findBestEntityMatch(text, entities);
}

export interface ResolvedParties<T extends { id: string; name: string }> {
  legalEntity: T | null;
  counterparty: T | null;
  counterpartyName: string | null;
  legalEntityDisplayName: string | null;
  counterpartyDisplayName: string | null;
}

function uniqueParts(...values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const value of values) {
    if (!value?.trim()) continue;
    for (const part of splitPartyNames(value)) {
      const key = normalizeEntityName(part);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      parts.push(part);
    }
  }

  return parts;
}

export function resolvePartiesFromExtraction<
  T extends { id: string; name: string },
>(
  legalEntityValue: string | null | undefined,
  counterpartyValue: string | null | undefined,
  legalEntities: T[],
  counterparties: T[]
): ResolvedParties<T> {
  const parts = uniqueParts(legalEntityValue, counterpartyValue);

  let legalEntity: T | null = null;
  const externalMatched: T[] = [];
  const externalNew: string[] = [];

  for (const part of parts) {
    const legalMatch = findBestEntityMatch(part, legalEntities);
    if (legalMatch) {
      if (!legalEntity) legalEntity = legalMatch;
      continue;
    }

    const counterpartyMatch = findBestEntityMatch(part, counterparties);
    if (counterpartyMatch) {
      if (!externalMatched.some((cp) => cp.id === counterpartyMatch.id)) {
        externalMatched.push(counterpartyMatch);
      }
      continue;
    }

    externalNew.push(part);
  }

  const counterparty = externalMatched[0] ?? null;
  const counterpartyName = counterparty?.name ?? externalNew[0] ?? null;
  const counterpartyDisplayParts = [
    ...externalMatched.map((cp) => cp.name),
    ...externalNew,
  ];

  return {
    legalEntity,
    counterparty,
    counterpartyName,
    legalEntityDisplayName: legalEntity?.name ?? null,
    counterpartyDisplayName: counterpartyDisplayParts.length
      ? counterpartyDisplayParts.join(", ")
      : null,
  };
}

export function stripKnownEntities(
  text: string | null | undefined,
  knownNames: string[]
): string | null {
  if (!text?.trim()) return null;

  const known = new Set(knownNames.map(normalizeEntityName));
  const remaining = splitPartyNames(text).filter(
    (part) => !known.has(normalizeEntityName(part))
  );

  if (!remaining.length) return null;
  return remaining.join(", ");
}

export function adjustPartyFields<
  T extends { key: string; value: string | null; confidence: number },
>(
  extracted: T[],
  legalEntities: { id: string; name: string }[],
  counterparties: { id: string; name: string }[] = []
): T[] {
  const result = extracted.map((item) => ({ ...item }));

  const legalIdx = result.findIndex((item) => item.key === "legal_entity");
  const counterIdx = result.findIndex((item) => item.key === "counterparty");
  if (legalIdx < 0 && counterIdx < 0) return result;

  const resolved = resolvePartiesFromExtraction(
    legalIdx >= 0 ? result[legalIdx].value : null,
    counterIdx >= 0 ? result[counterIdx].value : null,
    legalEntities,
    counterparties
  );

  if (!resolved.legalEntity && !resolved.counterpartyDisplayName) return result;

  if (legalIdx >= 0 && resolved.legalEntityDisplayName) {
    result[legalIdx].value = resolved.legalEntityDisplayName;
    if (result[legalIdx].confidence < 0.75) {
      result[legalIdx].confidence = 0.85;
    }
  }

  if (counterIdx >= 0 && resolved.counterpartyDisplayName) {
    result[counterIdx].value = resolved.counterpartyDisplayName;
    if (result[counterIdx].confidence < 0.75) {
      result[counterIdx].confidence = 0.85;
    }
  }

  return result;
}
