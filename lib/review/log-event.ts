import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyReviewAction,
  REVIEW_POINTS,
  ReviewAction,
} from "@/lib/dashboard/charts";

export async function logMetadataReviewEvent(options: {
  userId: string;
  userEmail: string | null;
  contractId: string;
  fieldId: string;
  previousValue: string | null | undefined;
  submittedValue: string | null | undefined;
}): Promise<void> {
  const action: ReviewAction = classifyReviewAction(
    options.previousValue,
    options.submittedValue
  );

  const supabase = createAdminClient();
  await supabase.from("metadata_review_events").insert({
    user_id: options.userId,
    user_email: options.userEmail,
    contract_id: options.contractId,
    field_id: options.fieldId,
    action,
    points: REVIEW_POINTS[action],
  });
}
