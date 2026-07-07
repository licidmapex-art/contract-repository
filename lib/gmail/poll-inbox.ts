import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";

function getGmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

export interface PollResult {
  processed: number;
  skipped: boolean;
  message?: string;
}

export async function pollGmailInbox(): Promise<PollResult> {
  const gmail = getGmailClient();
  const userId = process.env.GMAIL_USER ?? "me";

  if (!gmail) {
    return {
      processed: 0,
      skipped: true,
      message: "Gmail credentials not configured",
    };
  }

  const supabase = createAdminClient();
  const list = await gmail.users.messages.list({
    userId,
    q: "is:unread has:attachment filename:pdf",
    maxResults: 10,
  });

  const messages = list.data.messages ?? [];
  let processed = 0;

  for (const msg of messages) {
    if (!msg.id) continue;

    const full = await gmail.users.messages.get({
      userId,
      id: msg.id,
      format: "full",
    });

    const parts = full.data.payload?.parts ?? [];
    const pdfParts = parts.filter(
      (p) =>
        p.filename?.toLowerCase().endsWith(".pdf") &&
        p.body?.attachmentId
    );

    for (const part of pdfParts) {
      if (!part.body?.attachmentId || !part.filename) continue;

      const attachment = await gmail.users.messages.attachments.get({
        userId,
        messageId: msg.id,
        id: part.body.attachmentId,
      });

      if (!attachment.data.data) continue;

      const buffer = Buffer.from(attachment.data.data, "base64");

      const { data: contract } = await supabase
        .from("contracts")
        .insert({ title: null })
        .select()
        .single();

      if (!contract) continue;

      const storagePath = `${contract.id}/${crypto.randomUUID()}.pdf`;
      await supabase.storage.from("contracts").upload(storagePath, buffer, {
        contentType: "application/pdf",
      });

      const { data: document } = await supabase
        .from("documents")
        .insert({
          contract_id: contract.id,
          role: "original",
          storage_path: storagePath,
          original_filename: part.filename,
          processing_status: "pending",
          uploaded_via: "email",
        })
        .select()
        .single();

      if (document) {
        await runExtractionPipeline(document.id, contract.id);
        processed++;
      }
    }

    await gmail.users.messages.modify({
      userId,
      id: msg.id,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
  }

  return { processed, skipped: false };
}
