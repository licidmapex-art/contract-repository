import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllContractsWithDetails } from "@/lib/contracts/fetch";
import {
  aggregateReviewScores,
  computeExpiringByMonth,
  ReviewAction,
} from "@/lib/dashboard/charts";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const supabase = createAdminClient();

  const [eventsResult, contracts] = await Promise.all([
    supabase
      .from("metadata_review_events")
      .select("user_id, user_email, action, points")
      .order("created_at", { ascending: false }),
    fetchAllContractsWithDetails(),
  ]);

  const reviewScores = aggregateReviewScores(
    (eventsResult.data ?? []).map((event) => ({
      user_id: event.user_id,
      user_email: event.user_email,
      action: event.action as ReviewAction,
      points: event.points,
    }))
  );

  const expiringByMonth = computeExpiringByMonth(contracts);

  return NextResponse.json({ reviewScores, expiringByMonth });
}
