"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContractWithDetails, Counterparty, LegalEntity } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { inputClass } from "@/lib/ui-classes";

export function ContractPartiesPanel({
  contract,
  onUpdate,
}: {
  contract: ContractWithDetails;
  onUpdate: () => void;
}) {
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/legal-entities").then((r) => r.json()),
      fetch("/api/counterparties").then((r) => r.json()),
    ]).then(([leData, cpData]) => {
      setLegalEntities(leData.legal_entities ?? []);
      setCounterparties(cpData.counterparties ?? []);
    });
  }, []);

  async function updateParties(
    legalEntityId: string | null,
    counterpartyId: string | null
  ) {
    setSaving(true);
    await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legal_entity_id: legalEntityId,
        counterparty_id: counterpartyId,
      }),
    });
    setSaving(false);
    onUpdate();
  }

  const extractedLegalEntity = contract.metadata_values.find(
    (v) => v.metadata_fields?.key === "legal_entity"
  )?.value;
  const extractedCounterparty = contract.metadata_values.find(
    (v) => v.metadata_fields?.key === "counterparty"
  )?.value;

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Parties</h2>
          <Link href="/entities" className="text-xs text-primary hover:underline">
            Manage parties
          </Link>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Our legal entity
            </label>
            <select
              value={contract.legal_entity_id ?? ""}
              onChange={(e) =>
                updateParties(e.target.value || null, contract.counterparty_id)
              }
              disabled={saving}
              className={inputClass + " disabled:opacity-50"}
            >
              <option value="">— Not linked —</option>
              {legalEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
            {extractedLegalEntity && !contract.legal_entity_id && (
              <p className="mt-1 text-xs text-muted">
                Extracted: {extractedLegalEntity}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Counterparty
            </label>
            <select
              value={contract.counterparty_id ?? ""}
              onChange={(e) =>
                updateParties(contract.legal_entity_id, e.target.value || null)
              }
              disabled={saving}
              className={inputClass + " disabled:opacity-50"}
            >
              <option value="">— Not linked —</option>
              {counterparties.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name}
                </option>
              ))}
            </select>
            {extractedCounterparty && !contract.counterparty_id && (
              <p className="mt-1 text-xs text-muted">
                Extracted: {extractedCounterparty}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
