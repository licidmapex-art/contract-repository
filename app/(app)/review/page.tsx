"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ContractWithDetails } from "@/lib/types";
import { inputClass } from "@/lib/ui-classes";

export default function ReviewPage() {
  const [contracts, setContracts] = useState<ContractWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((data) => {
        const pending = (data.contracts ?? []).filter(
          (c: ContractWithDetails) => c.pending_review_count > 0
        );
        setContracts(pending);
        setLoading(false);
      });
  }, []);

  async function confirmField(
    contractId: string,
    fieldId: string,
    value: string
  ) {
    await fetch(`/api/contracts/${contractId}/metadata/${fieldId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });

    setContracts((prev) =>
      prev
        .map((c) => {
          if (c.id !== contractId) return c;
          const updatedValues = c.metadata_values.map((mv) =>
            mv.field_id === fieldId
              ? { ...mv, value, confirmed: true }
              : mv
          );
          return {
            ...c,
            metadata_values: updatedValues,
            pending_review_count: updatedValues.filter((v) => !v.confirmed)
              .length,
          };
        })
        .filter((c) => c.pending_review_count > 0)
    );
  }

  if (loading) return <p className="text-muted">Loading review queue...</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Low-confidence fields awaiting human confirmation
      </p>

      {!contracts.length ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
          <p className="font-medium text-success">All caught up!</p>
          <p className="mt-1 text-sm text-muted">No fields need review.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <Card key={contract.id}>
              <CardContent>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {contract.display_name ?? contract.title ?? "Untitled"}
                    </Link>
                    <div className="mt-1">
                      <StatusChip status={contract.effective_status} />
                    </div>
                  </div>
                  <span className="text-sm text-warning">
                    {contract.pending_review_count} field(s)
                  </span>
                </div>

                <div className="space-y-2">
                  {contract.metadata_values
                    .filter((mv) => !mv.confirmed)
                    .map((mv) => (
                      <ReviewField
                        key={mv.id}
                        label={mv.metadata_fields?.label ?? "Unknown"}
                        value={mv.value ?? ""}
                        confidence={mv.confidence}
                        onConfirm={(value) =>
                          confirmField(contract.id, mv.field_id, value)
                        }
                      />
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewField({
  label,
  value,
  confidence,
  onConfirm,
}: {
  label: string;
  value: string;
  confidence: number | null;
  onConfirm: (value: string) => void;
}) {
  const [editValue, setEditValue] = useState(value);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3">
      <div className="flex-1">
        <p className="text-xs font-medium text-muted">{label}</p>
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className={inputClass + " mt-1"}
        />
        {confidence !== null && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI confidence: {Math.round(confidence * 100)}%
          </p>
        )}
      </div>
      <Button size="sm" onClick={() => onConfirm(editValue)}>
        Confirm
      </Button>
    </div>
  );
}
