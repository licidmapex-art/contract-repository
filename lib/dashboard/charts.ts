import { createAdminClient } from "@/lib/supabase/admin";

export type ReviewAction = "confirm" | "correct";

export const REVIEW_POINTS: Record<ReviewAction, number> = {
  confirm: 1,
  correct: 5,
};

export function classifyReviewAction(
  previousValue: string | null | undefined,
  submittedValue: string | null | undefined
): ReviewAction {
  const prev = previousValue?.trim() ?? "";
  const next = submittedValue?.trim() ?? "";
  if (prev !== next) return "correct";
  return "confirm";
}

export interface ReviewScoreRow {
  userId: string;
  userEmail: string;
  confirmCount: number;
  correctCount: number;
  score: number;
}

export function aggregateReviewScores(
  events: {
    user_id: string;
    user_email: string | null;
    action: ReviewAction;
    points: number;
  }[]
): ReviewScoreRow[] {
  const byUser = new Map<
    string,
    { userEmail: string; confirmCount: number; correctCount: number; score: number }
  >();

  for (const event of events) {
    const existing = byUser.get(event.user_id) ?? {
      userEmail: event.user_email ?? "Unknown user",
      confirmCount: 0,
      correctCount: 0,
      score: 0,
    };

    if (event.action === "confirm") existing.confirmCount++;
    if (event.action === "correct") existing.correctCount++;
    existing.score += event.points;
    if (event.user_email) existing.userEmail = event.user_email;

    byUser.set(event.user_id, existing);
  }

  return [...byUser.entries()]
    .map(([userId, row]) => ({
      userId,
      userEmail: row.userEmail,
      confirmCount: row.confirmCount,
      correctCount: row.correctCount,
      score: row.score,
    }))
    .sort((a, b) => b.score - a.score);
}

export interface ExpiringMonthRow {
  monthKey: string;
  label: string;
  count: number;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthLabel(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function parseExpiryDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function computeExpiringByMonth(
  contracts: {
    metadata_values: {
      metadata_fields?: { key: string } | null;
      value: string | null;
    }[];
  }[],
  referenceDate: Date = new Date(),
  monthsAhead = 3
): ExpiringMonthRow[] {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + monthsAhead);
  end.setHours(23, 59, 59, 999);

  const buckets = new Map<string, ExpiringMonthRow>();

  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(monthKey, {
      monthKey,
      label: monthLabel(d.getFullYear(), d.getMonth()),
      count: 0,
    });
  }

  for (const contract of contracts) {
    const expiryRaw = contract.metadata_values.find(
      (mv) => mv.metadata_fields?.key === "expiry_date"
    )?.value;
    const expiry = parseExpiryDate(expiryRaw);
    if (!expiry) continue;
    if (expiry < start || expiry > end) continue;

    const monthKey = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(monthKey);
    if (bucket) bucket.count++;
  }

  return [...buckets.values()];
}

export async function fetchExpiringByMonthFromDb(
  referenceDate: Date = new Date(),
  monthsAhead = 3
): Promise<ExpiringMonthRow[]> {
  const supabase = createAdminClient();

  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + monthsAhead);
  end.setHours(23, 59, 59, 999);

  const buckets = new Map<string, ExpiringMonthRow>();

  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(monthKey, {
      monthKey,
      label: monthLabel(d.getFullYear(), d.getMonth()),
      count: 0,
    });
  }

  const { data: expiryField } = await supabase
    .from("metadata_fields")
    .select("id")
    .eq("key", "expiry_date")
    .maybeSingle();

  if (!expiryField) {
    return [...buckets.values()];
  }

  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from("metadata_values")
    .select("value")
    .eq("field_id", expiryField.id)
    .not("value", "is", null)
    .gte("value", startIso)
    .lte("value", endIso);

  for (const row of rows ?? []) {
    const expiry = parseExpiryDate(row.value);
    if (!expiry || expiry < start || expiry > end) continue;

    const monthKey = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(monthKey);
    if (bucket) bucket.count++;
  }

  return [...buckets.values()];
}
