"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import type { PublicApiKey } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { inputClass, labelClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const statusStyles: Record<
  NonNullable<PublicApiKey["last_test_status"]>,
  string
> = {
  ok: "text-success",
  quota_exceeded: "text-warning",
  invalid: "text-danger",
  error: "text-danger",
};

const statusLabels: Record<
  NonNullable<PublicApiKey["last_test_status"]>,
  string
> = {
  ok: "Valid",
  quota_exceeded: "Quota exhausted",
  invalid: "Invalid",
  error: "Error",
};

export default function ApiKeysSettingsPage() {
  const [keys, setKeys] = useState<PublicApiKey[]>([]);
  const [model, setModel] = useState("gemini-2.5-flash");
  const [loading, setLoading] = useState(true);
  const [savingModel, setSavingModel] = useState(false);
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [migrationSql, setMigrationSql] = useState("");
  const [sqlEditorUrl, setSqlEditorUrl] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const loadKeys = useCallback(async () => {
    const res = await fetch("/api/api-keys");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to load API keys");
    }
    setKeys(data.keys ?? []);
    setModel(data.model ?? "gemini-2.5-flash");
    setMigrationRequired(Boolean(data.migrationRequired));
    setMigrationSql(data.migrationSql ?? "");
    setSqlEditorUrl(data.sqlEditorUrl ?? null);
  }, []);

  useEffect(() => {
    loadKeys()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadKeys]);

  async function handleSaveModel(e: React.FormEvent) {
    e.preventDefault();
    setSavingModel(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/api-keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    const data = await res.json();

    setSavingModel(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save model");
      return;
    }

    setModel(data.model);
    setMessage("Model saved.");
  }

  async function handleAddKey(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: newKey,
        label: newLabel,
      }),
    });
    const data = await res.json();

    setAdding(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to add API key");
      return;
    }

    setNewKey("");
    setNewLabel("");
    await loadKeys();
    setMessage(
      data.test?.status === "ok"
        ? "API key added and verified."
        : data.test?.message ?? "API key added."
    );
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setError(null);
    setMessage(null);

    const res = await fetch(`/api/api-keys/${id}/test`, { method: "POST" });
    const data = await res.json();

    setTestingId(null);
    if (!res.ok) {
      setError(data.error ?? "Test failed");
      return;
    }

    setKeys((prev) => prev.map((key) => (key.id === id ? data.key : key)));
    setMessage(data.test?.message ?? "Test complete.");
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this API key?")) return;

    setError(null);
    setMessage(null);

    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to delete API key");
      return;
    }

    await loadKeys();
    setMessage("API key removed.");
  }

  async function moveKey(id: string, direction: -1 | 1) {
    const index = keys.findIndex((key) => key.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= keys.length) return;

    const next = [...keys];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);

    setKeys(next);
    setReordering(true);
    setError(null);

    const res = await fetch("/api/api-keys/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((key) => key.id) }),
    });
    const data = await res.json();

    setReordering(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to reorder keys");
      await loadKeys();
      return;
    }

    setMessage("Failover order updated.");
  }

  if (loading) {
    return <p className="text-muted">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {migrationRequired && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              One-time database setup required
            </p>
            <p className="text-sm text-muted">
              The <code className="text-xs">api_keys</code> table has not been
              created yet. Until you run the migration below, keys from{" "}
              <code className="text-xs">.env.local</code> still work for AI
              features, but you cannot save keys in Settings.
            </p>
            {sqlEditorUrl && (
              <a
                href={sqlEditorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-primary hover:underline"
              >
                Open Supabase SQL Editor
              </a>
            )}
            <textarea
              readOnly
              value={migrationSql}
              rows={12}
              className={inputClass + " font-mono text-xs"}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(migrationSql);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
              >
                {copiedSql ? "Copied" : "Copy SQL"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  loadKeys()
                    .catch((err: Error) => setError(err.message))
                    .finally(() => setLoading(false));
                }}
              >
                I ran the migration — refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted">
        Gemini API keys power metadata extraction, OCR, and contract Q&amp;A.
        Keys are tried top to bottom; when one hits its free-tier limit, the
        next key is used automatically.
      </p>

      <Card>
        <CardContent>
          <form onSubmit={handleSaveModel} className="space-y-3">
            <h2 className="font-semibold text-foreground">Gemini model</h2>
            <div>
              <label className={labelClass}>Model name</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputClass + " font-mono"}
                placeholder="gemini-2.5-flash"
              />
              <p className="mt-1 text-xs text-muted">
                Use gemini-2.5-flash. Gemini 2.0 models often have no free quota
                in the EU.
              </p>
            </div>
            <Button type="submit" disabled={savingModel || migrationRequired}>
              {savingModel ? "Saving..." : "Save model"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-foreground">API keys</h2>
            {reordering && (
              <span className="text-xs text-muted">Saving order...</span>
            )}
          </div>

          {keys.length === 0 ? (
            <p className="text-sm text-muted">
              No API keys yet. Add your first Gemini key below.
            </p>
          ) : (
            <ul className="space-y-2">
              {keys.map((key, index) => (
                <li
                  key={key.id}
                  className="rounded-lg border border-border p-3 transition-colors hover:bg-accent/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 shrink-0 text-muted" />
                        <p className="truncate text-sm font-medium text-foreground">
                          {key.label || `Key ${index + 1}`}
                        </p>
                        {index === 0 && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted">
                        {key.api_key_masked}
                      </p>
                      {key.last_test_status && (
                        <p
                          className={cn(
                            "mt-2 text-xs",
                            statusStyles[key.last_test_status]
                          )}
                        >
                          {statusLabels[key.last_test_status]}
                          {key.last_test_message ? ` — ${key.last_test_message}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveKey(key.id, -1)}
                        disabled={index === 0 || reordering}
                        className="rounded p-1 text-muted hover:bg-accent disabled:opacity-40"
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveKey(key.id, 1)}
                        disabled={index === keys.length - 1 || reordering}
                        className="rounded p-1 text-muted hover:bg-accent disabled:opacity-40"
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTest(key.id)}
                        disabled={testingId === key.id}
                      >
                        {testingId === key.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDelete(key.id)}
                        className="rounded p-1 text-danger hover:bg-danger/10"
                        title="Remove key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <form onSubmit={handleAddKey} className="space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Plus className="h-4 w-4" />
              Add API key
            </h2>

            <div>
              <label className={labelClass}>Label</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Backup key"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Gemini API key</label>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="AIza..."
                required
                className={inputClass + " font-mono"}
              />
              <p className="mt-1 text-xs text-muted">
                Get keys from{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google AI Studio
                </a>
                . Keys are stored in your database and only shown masked here.
              </p>
            </div>

            <Button type="submit" disabled={adding || !newKey.trim() || migrationRequired}>
              {adding ? "Adding..." : "Add and test key"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {message && (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
