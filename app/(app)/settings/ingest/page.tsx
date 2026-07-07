"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function IngestSettingsPage() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/ingest/gmail-sync", { method: "POST" });
    const data = await res.json();

    setLoading(false);
    if (!res.ok) {
      setResult(`Error: ${data.error}`);
      return;
    }

    if (data.skipped) {
      setResult(data.message ?? "Gmail not configured.");
      return;
    }

    setResult(`Processed ${data.processed} PDF attachment(s) from inbox.`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <p className="text-sm text-muted">
        Poll the configured Gmail inbox for unread emails with PDF attachments.
        Requires GMAIL_* environment variables. In production, a scheduled cron
        runs every 5 minutes.
      </p>

      <Card>
        <CardContent>
          <Button
            onClick={handleSync}
            disabled={loading}
            icon={<Mail className="h-4 w-4" />}
          >
            {loading ? "Syncing..." : "Sync inbox now"}
          </Button>

          {result && <p className="mt-4 text-sm text-muted">{result}</p>}
        </CardContent>
      </Card>

      <Card className="bg-accent/30">
        <CardContent>
          <p className="font-medium text-foreground">Setup checklist</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            <li>Create a dedicated Gmail inbox for contracts</li>
            <li>Enable Gmail API in Google Cloud Console</li>
            <li>Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN</li>
            <li>Configure CRON_SECRET and schedule /api/cron/gmail-poll</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
