import { DocumentRole } from "@/lib/types";

const DATE_FIELD_KEYS = new Set(["effective_date", "expiry_date"]);

const TOKEN_ALIASES: Record<string, string> = {
  effective_date: "effective_date",
  "effective date": "effective_date",
  "effective-date": "effective_date",
  expiry_date: "expiry_date",
  "expiry date": "expiry_date",
  contract_type: "contract_type",
  "contract type": "contract_type",
  counterparty: "counterparty",
  legal_entity: "legal_entity",
  "legal entity": "legal_entity",
  document_role: "document_role",
  "document role": "document_role",
};

const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function parseMonthName(value: string): string | null {
  return MONTHS[value.toLowerCase()] ?? null;
}

function parseToIso(value: string): string | null {
  const trimmed = value
    .trim()
    .replace(/(\d{1,2})(st|nd|rd|th)\b/gi, "$1");

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  const eu = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (eu) {
    const [, day, month, year] = eu;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dayMonthYear = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayMonthYear) {
    const [, day, monthName, year] = dayMonthYear;
    const month = parseMonthName(monthName);
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  const monthDayYear = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDayYear) {
    const [, monthName, day, year] = monthDayYear;
    const month = parseMonthName(monthName);
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatTextToken(value: string): string {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(" ");
}

export function formatDateForFilename(value: string): string {
  const iso = parseToIso(value);
  if (iso) {
    const [year, month, day] = iso.split("-");
    const monthName = MONTH_NAMES[Number(month) - 1];
    return `${Number(day)} ${titleCaseWord(monthName)} ${year}`;
  }

  const formatted = formatTextToken(value);
  return formatted || "Unknown";
}

function formatMetadataToken(key: string, value: string): string {
  if (DATE_FIELD_KEYS.has(key) || key.endsWith("_date")) {
    return formatDateForFilename(value);
  }
  return formatTextToken(value);
}

export function extractTemplateTokens(template: string): string[] {
  return [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

function resolveTokenKey(token: string): string {
  return TOKEN_ALIASES[token.trim().toLowerCase()] ?? token.trim();
}

export function applyNamingTemplate(
  template: string,
  metadata: Record<string, string | null>,
  documentRole: DocumentRole
): string {
  const filled = template.replace(/\{([^}]+)\}/g, (_, rawToken) => {
    const key = resolveTokenKey(rawToken);
    const rawValue = key === "document_role" ? documentRole : metadata[key];
    if (!rawValue?.trim()) return "Unknown";
    return formatMetadataToken(key, rawValue);
  });

  // Underscores in the template denote separators (e.g. hyphens); not used inside values.
  return filled.replace(/_/g, "-").replace(/\s+/g, " ").trim();
}

export function resolveCollision(
  baseName: string,
  existingNames: string[]
): string {
  if (!existingNames.includes(baseName)) return baseName;

  let counter = 2;
  while (existingNames.includes(`${baseName} (${counter})`)) {
    counter++;
  }
  return `${baseName} (${counter})`;
}
