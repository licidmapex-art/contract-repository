"use client";

import { useEffect, useState } from "react";
import { applyNamingTemplate } from "@/lib/naming/apply-template";
import { NamingSettings } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { inputClass, labelClass } from "@/lib/ui-classes";

export default function NamingSettingsPage() {
  const [settings, setSettings] = useState<NamingSettings | null>(null);
  const [template, setTemplate] = useState("");
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/naming-settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data.settings);
        setTemplate(data.settings?.template ?? "");
        setKeepOriginal(data.settings?.keep_original_name ?? true);
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/naming-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template,
        keep_original_name: keepOriginal,
      }),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (loading) return <p className="text-muted">Loading...</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <p className="text-sm text-muted">
        Controls how contract titles appear on the dashboard and contract detail
        page. Uploaded document filenames are not changed.
      </p>

      <Card>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className={labelClass}>Template</label>
              <input
                type="text"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className={inputClass + " font-mono"}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tokens: {"{contract_type}"}, {"{counterparty}"}, {"{effective_date}"},
                {"{document_role}"}, and any metadata field key
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={keepOriginal}
                onChange={(e) => setKeepOriginal(e.target.checked)}
                className="rounded border-border"
              />
              Keep original filename in audit trail
            </label>

            <div className="rounded-lg bg-accent/50 p-3">
              <p className="text-xs font-medium text-muted">Preview</p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {applyNamingTemplate(
                  template,
                  {
                    contract_type: "MSA",
                    counterparty: "Acme Corp",
                    effective_date: "2025-01-15",
                  },
                  "original"
                )}
                .pdf
              </p>
            </div>

            <Button type="submit">Save settings</Button>

            {saved && <p className="text-sm text-success">Settings saved.</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
