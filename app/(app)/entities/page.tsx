"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LegalEntity, Counterparty, ContractType } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { inputClass, labelClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type Tab = "legal-entities" | "counterparties" | "contract-types";

export default function EntitiesPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <EntitiesPageContent />
    </Suspense>
  );
}

function EntitiesPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    initialTab === "contract-types" || initialTab === "counterparties"
      ? initialTab
      : "legal-entities"
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <p className="text-sm text-muted">
        Manage legal entities, counterparties, and contract types. Link parties
        and select contract types from the contract detail page.
      </p>

      <div className="flex gap-1 rounded-lg border border-border bg-accent/30 p-1">
        <TabButton
          active={tab === "legal-entities"}
          onClick={() => setTab("legal-entities")}
        >
          Legal entities
        </TabButton>
        <TabButton
          active={tab === "counterparties"}
          onClick={() => setTab("counterparties")}
        >
          Counterparties
        </TabButton>
        <TabButton
          active={tab === "contract-types"}
          onClick={() => setTab("contract-types")}
        >
          Contract types
        </TabButton>
      </div>

      {tab === "legal-entities" && <LegalEntitiesTab />}
      {tab === "counterparties" && <CounterpartiesTab />}
      {tab === "contract-types" && <ContractTypesTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function LegalEntitiesTab() {
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [country, setCountry] = useState("");
  const [vatNumber, setVatNumber] = useState("");

  async function loadEntities() {
    setLoadError(null);
    const res = await fetch("/api/legal-entities");
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoadError(
        data.error ??
          "Could not load legal entities. Run supabase/migrations/002_entities.sql in Supabase if you have not yet."
      );
      setEntities([]);
    } else {
      setEntities(data.legal_entities ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadEntities();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/legal-entities/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    setUploading(false);
    e.target.value = "";

    if (!res.ok) {
      setMessage(data.error ?? "Upload failed");
      return;
    }

    setMessage(`Imported ${data.imported} legal entit${data.imported === 1 ? "y" : "ies"}.`);
    loadEntities();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const res = await fetch("/api/legal-entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        registration_number: registrationNumber,
        country,
        vat_number: vatNumber,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error ?? "Failed to add legal entity");
      return;
    }

    setName("");
    setRegistrationNumber("");
    setCountry("");
    setVatNumber("");
    setMessage("Legal entity added.");
    loadEntities();
  }

  async function handleDelete(id: string, entityName: string) {
    if (!window.confirm(`Delete "${entityName}"?`)) return;

    const res = await fetch(`/api/legal-entities/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Delete failed");
      return;
    }
    loadEntities();
  }

  if (loading) return <p className="text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {loadError}
        </p>
      )}
      <Card>
        <CardContent>
          <h2 className="mb-2 font-semibold text-foreground">Import from Excel</h2>
          <p className="mb-3 text-sm text-muted">
            Upload an .xlsx or .xls file with columns: Name, Registration number,
            Country, VAT number, Notes. The first row can be headers. Existing
            names are updated.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-accent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/80">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            {uploading ? "Uploading..." : "Choose Excel file"}
          </label>
        </CardContent>
      </Card>

      <EntityList
        title="Legal entities"
        emptyMessage="No legal entities yet. Add one below or import from Excel."
        rows={entities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          details: [
            entity.registration_number,
            entity.country,
            entity.vat_number,
          ]
            .filter(Boolean)
            .join(" · "),
          onDelete: () => handleDelete(entity.id, entity.name),
        }))}
      />

      <EntityForm
        title="Add legal entity"
        onSubmit={handleCreate}
        fields={[
          { label: "Name", value: name, onChange: setName, required: true },
          {
            label: "Registration number",
            value: registrationNumber,
            onChange: setRegistrationNumber,
          },
          { label: "Country", value: country, onChange: setCountry },
          { label: "VAT number", value: vatNumber, onChange: setVatNumber },
        ]}
      />

      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}

function CounterpartiesTab() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");

  async function loadCounterparties() {
    setLoadError(null);
    const res = await fetch("/api/counterparties");
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoadError(
        data.error ??
          "Could not load counterparties. Run supabase/migrations/002_entities.sql in Supabase if you have not yet."
      );
      setCounterparties([]);
    } else {
      setCounterparties(data.counterparties ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCounterparties();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const res = await fetch("/api/counterparties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        registration_number: registrationNumber,
        country,
        notes,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error ?? "Failed to add counterparty");
      return;
    }

    setName("");
    setRegistrationNumber("");
    setCountry("");
    setNotes("");
    setMessage("Counterparty added.");
    loadCounterparties();
  }

  async function handleDelete(id: string, counterpartyName: string) {
    if (!window.confirm(`Delete "${counterpartyName}"?`)) return;

    const res = await fetch(`/api/counterparties/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Delete failed");
      return;
    }
    loadCounterparties();
  }

  if (loading) return <p className="text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {loadError}
        </p>
      )}
      <p className="text-sm text-muted">
        Counterparties are external organizations you contract with. AI
        extraction still fills the counterparty metadata field; you can link a
        contract to a managed counterparty here.
      </p>

      <EntityList
        title="Counterparties"
        emptyMessage="No counterparties yet."
        rows={counterparties.map((cp) => ({
          id: cp.id,
          name: cp.name,
          details: [cp.registration_number, cp.country].filter(Boolean).join(" · "),
          onDelete: () => handleDelete(cp.id, cp.name),
        }))}
      />

      <EntityForm
        title="Add counterparty"
        onSubmit={handleCreate}
        fields={[
          { label: "Name", value: name, onChange: setName, required: true },
          {
            label: "Registration number",
            value: registrationNumber,
            onChange: setRegistrationNumber,
          },
          { label: "Country", value: country, onChange: setCountry },
          { label: "Notes", value: notes, onChange: setNotes },
        ]}
      />

      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}

function EntityList({
  title,
  emptyMessage,
  rows,
}: {
  title: string;
  emptyMessage: string;
  rows: {
    id: string;
    name: string;
    details: string;
    onDelete: () => void;
  }[];
}) {
  return (
    <Card>
      <CardContent>
        <h2 className="mb-3 font-semibold text-foreground">{title}</h2>
        {!rows.length ? (
          <p className="text-sm text-muted">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent/30"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{row.name}</p>
                  {row.details && (
                    <p className="text-xs text-muted">{row.details}</p>
                  )}
                </div>
                <button
                  onClick={row.onDelete}
                  className="text-xs text-danger hover:underline"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EntityForm({
  title,
  onSubmit,
  fields,
}: {
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  fields: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
  }[];
}) {
  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((field) => (
              <div key={field.label}>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {field.label}
                </label>
                <input
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  required={field.required}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <Button type="submit">Add</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ContractTypesTab() {
  const [types, setTypes] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  async function loadTypes() {
    setLoadError(null);
    const res = await fetch("/api/contract-types");
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoadError(
        data.error ??
          "Could not load contract types. Run supabase/migrations/006_contract_types.sql in Supabase if you have not yet."
      );
      setTypes([]);
    } else {
      setTypes(data.contract_types ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTypes();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/contract-types/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    setUploading(false);
    e.target.value = "";

    if (!res.ok) {
      setMessage(data.error ?? "Upload failed");
      return;
    }

    setMessage(
      `Imported ${data.imported} contract type${data.imported === 1 ? "" : "s"}.`
    );
    loadTypes();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const res = await fetch("/api/contract-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, notes }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error ?? "Failed to add contract type");
      return;
    }

    setName("");
    setDescription("");
    setNotes("");
    setMessage("Contract type added.");
    loadTypes();
  }

  async function handleDelete(id: string, typeName: string) {
    if (!window.confirm(`Delete "${typeName}"?`)) return;

    const res = await fetch(`/api/contract-types/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Delete failed");
      return;
    }
    loadTypes();
  }

  if (loading) return <p className="text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {loadError}
        </p>
      )}
      <Card>
        <CardContent>
          <h2 className="mb-2 font-semibold text-foreground">Import from Excel</h2>
          <p className="mb-3 text-sm text-muted">
            Upload an .xlsx or .xls file with columns: Name, Description, Notes.
            The first row can be headers. Existing names are updated.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-accent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/80">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            {uploading ? "Uploading..." : "Choose Excel file"}
          </label>
        </CardContent>
      </Card>

      <EntityList
        title="Contract types"
        emptyMessage="No contract types yet. Add one below or import from Excel."
        rows={types.map((type) => ({
          id: type.id,
          name: type.name,
          details: [type.description, type.notes].filter(Boolean).join(" · "),
          onDelete: () => handleDelete(type.id, type.name),
        }))}
      />

      <EntityForm
        title="Add contract type"
        onSubmit={handleCreate}
        fields={[
          { label: "Name", value: name, onChange: setName, required: true },
          { label: "Description", value: description, onChange: setDescription },
          { label: "Notes", value: notes, onChange: setNotes },
        ]}
      />

      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
