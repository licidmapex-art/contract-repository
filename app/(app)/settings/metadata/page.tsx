"use client";

import { useEffect, useState } from "react";
import { MetadataField } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { inputClass } from "@/lib/ui-classes";

export default function MetadataFieldsPage() {
  const [fields, setFields] = useState<MetadataField[]>([]);
  const [loading, setLoading] = useState(true);
  const [reExtracting, setReExtracting] = useState<string | null>(null);

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [playbookPrompt, setPlaybookPrompt] = useState("");
  const [category, setCategory] = useState("custom");
  const [fieldType, setFieldType] = useState("text");
  const [message, setMessage] = useState<string | null>(null);

  async function loadFields() {
    const res = await fetch("/api/metadata-fields");
    const data = await res.json();
    setFields(data.fields ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadFields();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const res = await fetch("/api/metadata-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        label,
        category,
        field_type: fieldType,
        playbook_prompt: playbookPrompt,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to create field");
      return;
    }

    setKey("");
    setLabel("");
    setPlaybookPrompt("");
    setMessage("Field created. Run re-extract to populate existing contracts.");
    loadFields();
  }

  async function handleReExtract(fieldId: string) {
    setReExtracting(fieldId);
    setMessage(null);

    const res = await fetch(`/api/metadata-fields/${fieldId}/re-extract`, {
      method: "POST",
    });
    const data = await res.json();

    setReExtracting(null);
    if (!res.ok) {
      setMessage(data.error ?? "Re-extract failed");
      return;
    }
    setMessage(`Re-extracted field across ${data.processed} contract(s).`);
  }

  if (loading) return <p className="text-muted">Loading...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-muted">
        Custom fields use AI playbook prompts. Re-extract applies a field to all
        existing contracts.
      </p>

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold text-foreground">Existing fields</h2>
          <ul className="space-y-2">
            {fields.map((field) => (
              <li
                key={field.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent/30"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {field.label}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({field.key})
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {field.category} · {field.field_type}
                    {field.is_builtin && " · built-in"}
                  </p>
                </div>
                <button
                  onClick={() => handleReExtract(field.id)}
                  disabled={reExtracting === field.id}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {reExtracting === field.id ? "Running..." : "Re-extract"}
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <h2 className="font-semibold text-foreground">Add custom field</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Key
                </label>
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="regulated"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Label
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Regulated"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Category
                </label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Type
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  className={inputClass}
                >
                  <option value="text">text</option>
                  <option value="date">date</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Playbook prompt
              </label>
              <textarea
                value={playbookPrompt}
                onChange={(e) => setPlaybookPrompt(e.target.value)}
                required
                rows={3}
                placeholder="Is this contract subject to financial regulation? Return true or false."
                className={inputClass}
              />
            </div>

            <Button type="submit">Create field</Button>
          </form>
        </CardContent>
      </Card>

      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
