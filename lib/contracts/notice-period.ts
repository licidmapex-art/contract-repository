import { ExtractedField } from "@/lib/gemini/extract";

export const NOTICE_PERIOD_FIELD_KEY = "notice_period";
export const LEGACY_NOTICE_PERIOD_FIELD_KEY = "notice_period_days";

export type NoticePeriodUnit =
  | "days"
  | "business_days"
  | "weeks"
  | "months"
  | "years"
  | "other";

export type NoticePeriodPurpose =
  | "any_time"
  | "avoid_auto_renewal"
  | "avoid_auto_termination"
  | "other";

export interface NoticePeriod {
  amount: number | null;
  unit: NoticePeriodUnit;
  unit_label: string | null;
  purpose: NoticePeriodPurpose;
  purpose_detail: string | null;
}

export const NOTICE_PERIOD_UNITS: {
  value: NoticePeriodUnit;
  label: string;
}[] = [
  { value: "days", label: "Days" },
  { value: "business_days", label: "Business days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
  { value: "other", label: "Other (as stated in contract)" },
];

export const NOTICE_PERIOD_PURPOSES: {
  value: NoticePeriodPurpose;
  label: string;
}[] = [
  { value: "any_time", label: "May be given at any time" },
  {
    value: "avoid_auto_renewal",
    label: "Only to avoid automatic renewal",
  },
  {
    value: "avoid_auto_termination",
    label: "Only to avoid automatic termination",
  },
  { value: "other", label: "Other (see detail)" },
];

export const NOTICE_PERIOD_PLAYBOOK = `Extract the notice period required for termination or non-renewal.
Return ONLY valid JSON (no markdown fences):
{
  "amount": 30,
  "unit": "days" | "business_days" | "weeks" | "months" | "years" | "other",
  "unit_label": "optional verbatim unit phrase from the contract, e.g. calendar months",
  "purpose": "any_time" | "avoid_auto_renewal" | "avoid_auto_termination" | "other",
  "purpose_detail": "optional short quote or explanation from the contract"
}

Rules:
- Follow the contract wording for the unit (days, business days, weeks, months, years).
- amount is numeric only; use null if no number is stated.
- purpose any_time: ordinary termination notice at any time during the term.
- purpose avoid_auto_renewal: notice solely to prevent automatic renewal or extension.
- purpose avoid_auto_termination: notice solely to prevent automatic termination at end of term.
- Return null for the whole field if no notice period is specified.`;

const UNIT_SET = new Set<string>(NOTICE_PERIOD_UNITS.map((u) => u.value));
const PURPOSE_SET = new Set<string>(NOTICE_PERIOD_PURPOSES.map((p) => p.value));

function unitLabel(unit: NoticePeriodUnit, unitLabel: string | null): string {
  if (unit === "other" && unitLabel?.trim()) return unitLabel.trim();
  const match = NOTICE_PERIOD_UNITS.find((item) => item.value === unit);
  return match?.label.toLowerCase() ?? unit;
}

export function purposeLabel(purpose: NoticePeriodPurpose): string {
  return (
    NOTICE_PERIOD_PURPOSES.find((item) => item.value === purpose)?.label ?? purpose
  );
}

export function formatNoticePeriod(period: NoticePeriod | null): string {
  if (!period) return "—";

  const parts: string[] = [];

  if (period.amount != null && Number.isFinite(period.amount)) {
    parts.push(`${period.amount} ${unitLabel(period.unit, period.unit_label)}`);
  } else if (period.unit_label?.trim()) {
    parts.push(period.unit_label.trim());
  } else if (period.unit !== "other") {
    parts.push(unitLabel(period.unit, null));
  }

  if (period.purpose && period.purpose !== "other") {
    parts.push(purposeLabel(period.purpose));
  } else if (period.purpose_detail?.trim()) {
    parts.push(period.purpose_detail.trim());
  }

  return parts.length ? parts.join(" — ") : "—";
}

function coerceUnit(value: unknown): NoticePeriodUnit {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (UNIT_SET.has(raw)) return raw as NoticePeriodUnit;
  if (raw.includes("business")) return "business_days";
  if (raw.includes("week")) return "weeks";
  if (raw.includes("month")) return "months";
  if (raw.includes("year")) return "years";
  if (raw.includes("day")) return "days";
  return "other";
}

function coercePurpose(value: unknown): NoticePeriodPurpose {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (PURPOSE_SET.has(raw)) return raw as NoticePeriodPurpose;
  if (raw.includes("renew")) return "avoid_auto_renewal";
  if (raw.includes("terminat") || raw.includes("expir")) {
    return "avoid_auto_termination";
  }
  return "other";
}

function coerceAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
}

export function normalizeNoticePeriod(
  input: Partial<NoticePeriod> | null | undefined
): NoticePeriod | null {
  if (!input) return null;

  const amount = coerceAmount(input.amount);
  const unit = coerceUnit(input.unit);
  const purpose = coercePurpose(input.purpose);
  const unit_label =
    typeof input.unit_label === "string" ? input.unit_label.trim() || null : null;
  const purpose_detail =
    typeof input.purpose_detail === "string"
      ? input.purpose_detail.trim() || null
      : null;

  if (
    amount == null &&
    !unit_label &&
    unit === "other" &&
    purpose === "other" &&
    !purpose_detail
  ) {
    return null;
  }

  return {
    amount,
    unit,
    unit_label,
    purpose,
    purpose_detail,
  };
}

export function parseNoticePeriod(
  value: string | null | undefined
): NoticePeriod | null {
  if (!value?.trim()) return null;

  const trimmed = value.trim();

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return normalizeNoticePeriod({
      amount: parseFloat(trimmed),
      unit: "days",
      unit_label: null,
      purpose: "any_time",
      purpose_detail: null,
    });
  }

  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? trimmed) as Partial<NoticePeriod>;
    return normalizeNoticePeriod(parsed);
  } catch {
    return normalizeNoticePeriod({
      amount: null,
      unit: "other",
      unit_label: trimmed,
      purpose: "other",
      purpose_detail: null,
    });
  }
}

export function serializeNoticePeriod(period: NoticePeriod | null): string | null {
  const normalized = normalizeNoticePeriod(period);
  if (!normalized) return null;
  return JSON.stringify(normalized);
}

export function normalizeNoticePeriodExtraction(
  extracted: ExtractedField[]
): ExtractedField[] {
  return extracted.map((item) => {
    if (
      item.key !== NOTICE_PERIOD_FIELD_KEY &&
      item.key !== LEGACY_NOTICE_PERIOD_FIELD_KEY
    ) {
      return item;
    }

    if (!item.value?.trim()) {
      return { ...item, key: NOTICE_PERIOD_FIELD_KEY, value: null };
    }

    const period = parseNoticePeriod(item.value);
    return {
      ...item,
      key: NOTICE_PERIOD_FIELD_KEY,
      value: serializeNoticePeriod(period),
    };
  });
}

export function isNoticePeriodFieldKey(key: string | undefined): boolean {
  return key === NOTICE_PERIOD_FIELD_KEY || key === LEGACY_NOTICE_PERIOD_FIELD_KEY;
}
