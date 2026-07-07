"use client";

import { useEffect, useMemo, useState } from "react";
import { ContractWithDetails } from "@/lib/types";
import {
  formatAutomaticRenewal,
  parseAutomaticRenewal,
  serializeAutomaticRenewal,
} from "@/lib/contracts/automatic-renewal";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/lib/ui-classes";
import { CONFIDENCE_THRESHOLD } from "@/lib/types";

export function AutomaticRenewalPanel({
  contract,
  onConfirmExtracted,
}: {
  contract: ContractWithDetails;
  onConfirmExtracted?: (fieldId: string, value: string) => void;
}) {
  const renewalMeta = useMemo(
    () =>
      contract.metadata_values.find(
        (mv) => mv.metadata_fields?.key === "automatic_renewal"
      ),
    [contract.metadata_values]
  );

  const parsed = useMemo(
    () => parseAutomaticRenewal(renewalMeta?.value ?? null),
    [renewalMeta?.value]
  );

  const [draft, setDraft] = useState<string>(
    parsed === true ? "true" : parsed === false ? "false" : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(parsed === true ? "true" : parsed === false ? "false" : "");
  }, [parsed]);

  if (!renewalMeta) return null;

  const needsReview =
    !renewalMeta.confirmed &&
    renewalMeta.value &&
    (renewalMeta.confidence ?? 0) < CONFIDENCE_THRESHOLD;

  const confidenceLabel =
    renewalMeta.confidence != null
      ? `${Math.round(renewalMeta.confidence * 100)}%`
      : "—";

  async function save() {
    if (!onConfirmExtracted) return;
    setSaving(true);
    const value =
      draft === ""
        ? ""
        : serializeAutomaticRenewal(draft === "true") ?? "";
    onConfirmExtracted(renewalMeta!.field_id, value);
    setSaving(false);
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-3 font-semibold text-foreground">Automatic renewal</h2>

        <p className="mb-3 text-sm text-muted">
          {formatAutomaticRenewal(parsed)}
        </p>

        <label className="mb-1 block text-xs font-medium text-muted">
          Does this contract renew automatically?
        </label>
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass + " text-sm"}
        >
          <option value="">Unknown</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>

        {onConfirmExtracted && (
          <Button size="sm" className="mt-3" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        )}

        {needsReview && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <p className="text-xs font-medium text-warning">
              AI suggestion ({confidenceLabel}) — needs review
            </p>
            <p className="mt-1 text-sm text-foreground">
              {formatAutomaticRenewal(
                parseAutomaticRenewal(renewalMeta.value)
              )}
            </p>
            {onConfirmExtracted && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() =>
                  onConfirmExtracted(
                    renewalMeta.field_id,
                    renewalMeta.value ?? ""
                  )
                }
              >
                Confirm
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
