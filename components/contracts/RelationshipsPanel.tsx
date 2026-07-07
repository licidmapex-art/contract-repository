"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContractRelationship, RELATIONSHIP_TYPES } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { inputClass } from "@/lib/ui-classes";

interface RelatedContract {
  id: string;
  title: string | null;
}

export function RelationshipsPanel({
  contractId,
  relationships,
  onUpdate,
}: {
  contractId: string;
  relationships: ContractRelationship[];
  onUpdate: () => void;
}) {
  const [contracts, setContracts] = useState<RelatedContract[]>([]);
  const [targetId, setTargetId] = useState("");
  const [relationshipType, setRelationshipType] =
    useState<(typeof RELATIONSHIP_TYPES)[number]>("related");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.contracts ?? [])
          .filter((c: { id: string }) => c.id !== contractId)
          .map((c: { id: string; title: string | null }) => ({
            id: c.id,
            title: c.title,
          }));
        setContracts(list);
      });
  }, [contractId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    setLoading(true);

    await fetch("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_a_id: contractId,
        contract_b_id: targetId,
        relationship_type: relationshipType,
      }),
    });

    setTargetId("");
    setLoading(false);
    onUpdate();
  }

  function resolveTitle(id: string): string {
    const match = contracts.find((c) => c.id === id);
    return match?.title ?? id.slice(0, 8);
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-3 font-semibold text-foreground">Relationships</h2>

        {relationships.length === 0 ? (
          <p className="mb-3 text-sm text-muted">No linked contracts yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {relationships.map((rel) => {
              const otherId =
                rel.contract_a_id === contractId
                  ? rel.contract_b_id
                  : rel.contract_a_id;
              return (
                <li
                  key={rel.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2 text-sm transition-colors hover:bg-accent/30"
                >
                  <Link
                    href={`/contracts/${otherId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {resolveTitle(otherId)}
                  </Link>
                  <span className="text-xs text-muted capitalize">
                    {rel.relationship_type.replace("_", " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className={inputClass + " min-w-[160px] flex-1"}
          >
            <option value="">Link to contract...</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title ?? "Untitled"}
              </option>
            ))}
          </select>
          <select
            value={relationshipType}
            onChange={(e) =>
              setRelationshipType(
                e.target.value as (typeof RELATIONSHIP_TYPES)[number]
              )
            }
            className={inputClass}
          >
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={loading || !targetId} size="sm">
            Link
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
