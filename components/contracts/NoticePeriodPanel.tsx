"use client";

import { useEffect, useMemo, useState } from "react";
import { ContractWithDetails } from "@/lib/types";
import {
  formatNoticePeriod,
  NOTICE_PERIOD_PURPOSES,
  NOTICE_PERIOD_UNITS,
  NoticePeriod,
  parseNoticePeriod,
  serializeNoticePeriod,
} from "@/lib/contracts/notice-period";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/lib/ui-classes";
import { CONFIDENCE_THRESHOLD } from "@/lib/types";

export function NoticePeriodPanel({
  contract,
  onConfirmExtracted,
}: {
  contract: ContractWithDetails;
  onConfirmExtracted?: (fieldId: string, value: string) => void;
}) {
  const noticeMeta = useMemo(() => {
    return contract.metadata_values.find((mv) =>
      ["notice_period", "notice_period_days"].includes(
        mv.metadata_fields?.key ?? ""
      )
    );
  }, [contract.metadata_values]);

  const parsed = useMemo(
    () => parseNoticePeriod(noticeMeta?.value ?? null),
    [noticeMeta?.value]
  );

  const [draft, setDraft] = useState<NoticePeriod | null>(parsed);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(parsed);
  }, [parsed]);

  const needsReview =
    noticeMeta &&
    !noticeMeta.confirmed &&
    noticeMeta.value &&
    (noticeMeta.confidence ?? 0) < CONFIDENCE_THRESHOLD;

  const confidenceLabel =
    noticeMeta?.confidence != null
      ? `${Math.round(noticeMeta.confidence * 100)}%`
      : "—";

  async function save() {
    if (!noticeMeta || !onConfirmExtracted) return;
    setSaving(true);
    onConfirmExtracted(
      noticeMeta.field_id,
      serializeNoticePeriod(draft) ?? ""
    );
    setSaving(false);
  }

  if (!noticeMeta) return null;

  function updateDraft(updates: Partial<NoticePeriod>) {
    setDraft((prev) => ({
      amount: prev?.amount ?? null,
      unit: prev?.unit ?? "days",
      unit_label: prev?.unit_label ?? null,
      purpose: prev?.purpose ?? "any_time",
      purpose_detail: prev?.purpose_detail ?? null,
      ...updates,
    }));
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-3 font-semibold text-foreground">Notice period</h2>

        {parsed && (
          <p className="mb-3 text-sm text-foreground">
            {formatNoticePeriod(parsed)}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Amount
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={draft?.amount ?? ""}
              onChange={(e) =>
                updateDraft({
                  amount: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={inputClass + " text-sm"}
              placeholder="e.g. 30"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Unit
            </label>
            <select
              value={draft?.unit ?? "days"}
              onChange={(e) =>
                updateDraft({
                  unit: e.target.value as NoticePeriod["unit"],
                })
              }
              className={inputClass + " text-sm"}
            >
              {NOTICE_PERIOD_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">
              Unit as stated in contract (optional)
            </label>
            <input
              type="text"
              value={draft?.unit_label ?? ""}
              onChange={(e) =>
                updateDraft({ unit_label: e.target.value || null })
              }
              className={inputClass + " text-sm"}
              placeholder="e.g. calendar months"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">
              When notice applies
            </label>
            <select
              value={draft?.purpose ?? "any_time"}
              onChange={(e) =>
                updateDraft({
                  purpose: e.target.value as NoticePeriod["purpose"],
                })
              }
              className={inputClass + " text-sm"}
            >
              {NOTICE_PERIOD_PURPOSES.map((purpose) => (
                <option key={purpose.value} value={purpose.value}>
                  {purpose.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">
              Detail from contract (optional)
            </label>
            <input
              type="text"
              value={draft?.purpose_detail ?? ""}
              onChange={(e) =>
                updateDraft({ purpose_detail: e.target.value || null })
              }
              className={inputClass + " text-sm"}
              placeholder="Short quote or explanation"
            />
          </div>
        </div>

        {onConfirmExtracted && (
          <Button size="sm" className="mt-3" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save notice period"}
          </Button>
        )}

        {needsReview && noticeMeta && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <p className="text-xs font-medium text-warning">
              AI suggestion ({confidenceLabel}) — needs review
            </p>
            <p className="mt-1 text-sm text-foreground">
              {formatNoticePeriod(parseNoticePeriod(noticeMeta.value))}
            </p>
            {onConfirmExtracted && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() =>
                  onConfirmExtracted(
                    noticeMeta.field_id,
                    noticeMeta.value ?? ""
                  )
                }
              >
                Confirm as extracted
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
