# Deployment Guide — Contract Repository Pilot

## Prerequisites

- [Netlify](https://netlify.com) account (free tier)
- [Supabase](https://supabase.com) project (free tier)
- [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- Optional: Gmail API credentials for email ingestion

## 1. Supabase setup

1. Create a new Supabase project.
2. In **SQL Editor** → **+ New query** (not a saved snippet), paste and run [`supabase/setup.sql`](supabase/setup.sql).
3. In **Authentication → Users**, create a pilot user (email/password).
5. Copy from **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only, never expose to client)

## 2. Environment variables

Set these in Netlify (**Site settings → Environment variables**) and locally in `.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `CRON_SECRET` | Yes (prod) | Random string for scheduled cron auth |
| `INGEST_SECRET` | Optional | Secret for manual email ingest API |
| `GMAIL_CLIENT_ID` | Optional | Gmail OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Optional | Gmail OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Optional | Gmail OAuth refresh token |
| `GMAIL_USER` | Optional | Gmail address (default: `me`) |

Generate secrets:

```bash
openssl rand -hex 32
```

## 3. Deploy to Netlify

1. Push the repo to GitHub.
2. In Netlify: **Add new site → Import from Git**.
3. Build settings (auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: handled by `@netlify/plugin-nextjs`
4. Add all environment variables from section 2.
5. Deploy.

## 4. Scheduled jobs

Configure an external cron (e.g. cron-job.org) or Netlify scheduled functions:

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `GET /api/cron/keep-alive` | Weekly | Prevents Supabase free-tier pause |
| `GET /api/cron/gmail-poll` | Every 5 min | Polls Gmail for PDF attachments |

Both require header: `x-cron-secret: <CRON_SECRET>`

## 5. Gmail ingestion (optional)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com).
2. Enable **Gmail API**.
3. Create OAuth 2.0 credentials.
4. Use [OAuth Playground](https://developers.google.com/oauthplayground) to obtain a refresh token with scope `https://www.googleapis.com/auth/gmail.modify`.
5. Set `GMAIL_*` env vars in Netlify.
6. Use **Settings → Email ingest → Sync inbox** in the app.

## 6. Post-deploy verification

1. Sign in at your Netlify URL.
2. Upload a native-text PDF via **Upload**.
3. Wait for extraction (polls every 5s on contract detail).
4. Confirm low-confidence fields in **Review**.
5. Verify generated filename and dashboard filters.
6. Test Q&A: "Which contracts expire this year?"
7. If Gmail configured, test **Settings → Email ingest → Sync inbox**.

## Pilot limitations

- No automated backups on Supabase free tier.
- Supabase pauses after 7 days of inactivity — use weekly keep-alive cron.
- No semantic search over document text.
- Scanned PDFs require OCR (not included).
- Single-tenant auth — no organization isolation.
