"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContractType, ContractWithDetails } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { inputClass } from "@/lib/ui-classes";

export function ContractTypePanel({
  contract,
  onUpdate,
}: {
  contract: ContractWithDetails;
  onUpdate: () => void;
}) {
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/contract-types")
      .then((r) => r.json())
      .then((data) => setContractTypes(data.contract_types ?? []));
  }, []);

  async function updateContractType(contractTypeId: string | null) {
    setSaving(true);
    await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract_type_id: contractTypeId }),
    });
    setSaving(false);
    onUpdate();
  }

  const extractedType = contract.metadata_values.find(
    (v) => v.metadata_fields?.key === "contract_type"
  )?.value;

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Contract type</h2>
          <Link
            href="/entities?tab=contract-types"
            className="text-xs text-primary hover:underline"
          >
            Manage types
          </Link>
        </div>

        <label className="mb-1 block text-xs font-medium text-muted">
          Type
        </label>
        <select
          value={contract.contract_type_id ?? ""}
          onChange={(e) => updateContractType(e.target.value || null)}
          disabled={saving}
          className={inputClass + " disabled:opacity-50"}
        >
          <option value="">— Not selected —</option>
          {contractTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        {extractedType && !contract.contract_type_id && (
          <p className="mt-1 text-xs text-muted">
            Extracted (unmatched): {extractedType}
          </p>
        )}
        {contract.contract_type?.description && (
          <p className="mt-2 text-xs text-muted">
            {contract.contract_type.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
