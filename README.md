# Contract Repository (Pilot)

Intelligent contract repository built per the pilot spec: upload PDFs, AI metadata extraction, human review, naming conventions, searchable dashboard, and in-app PDF reading.

## Stack

- **Next.js 15** (App Router) on Netlify
- **Supabase** (Postgres, Auth, Storage)
- **Gemini Flash** for metadata extraction and structured Q&A
- **Gmail API** for optional email ingestion

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Gemini keys
npm run dev
```

See [DEPLOY.md](DEPLOY.md) for full Supabase, Netlify, Gmail, and cron setup.

### Supabase database setup

1. Open your project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **+ New query**
3. Paste the full contents of [`supabase/setup.sql`](supabase/setup.sql) and click **Run**

**Important:** Do not open a saved SQL snippet from the sidebar or a shared link. The error `Unable to find snippet with ID ...` means Supabase is trying to load a deleted snippet — always use **+ New query** and paste the SQL from this repo.

4. Create a user under **Authentication → Users**

## Features

### Phase 1 — Core loop
- Upload PDFs (UI) with role tagging and contract linking
- AI extraction of metadata fields (Gemini, batched)
- Auto-confirm high-confidence fields (≥75%)
- Review queue for low-confidence fields
- Dashboard with status filters, metric cards, onion filters
- In-app PDF viewer with search highlighting
- Naming convention templates

### Phase 2 — Full pilot
- Structured Q&A over metadata (`/api/ask`, dashboard Ask box)
- Gmail inbox polling (`/api/cron/gmail-poll`) + manual sync UI
- Contract relationships (link contracts with typed relationships)
- Custom metadata fields + re-extract across existing contracts
- Weekly keep-alive cron to prevent Supabase pause

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm test` | Domain logic unit tests |
| `npm run lint` | ESLint |

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/contracts/upload` | Upload PDFs, trigger extraction |
| GET | `/api/contracts` | List with filters |
| GET | `/api/contracts/:id` | Contract detail |
| POST | `/api/contracts/:id/metadata/:fieldId/confirm` | Confirm metadata |
| GET/POST | `/api/metadata-fields` | List / create fields |
| POST | `/api/metadata-fields/:fieldId/re-extract` | Re-run extraction for one field |
| POST | `/api/relationships` | Link contracts |
| POST | `/api/ask` | Structured Q&A |
| POST | `/api/ingest/gmail-sync` | Manual Gmail sync |
| GET | `/api/cron/gmail-poll` | Scheduled Gmail poll |
| GET | `/api/cron/keep-alive` | Scheduled Supabase ping |

## Pilot limitations

- No vector/semantic search over document text
- Supabase free tier pauses after 7 days inactivity (use keep-alive cron)
- OCR for scanned PDFs not included (native-text PDFs only)
- Single-tenant auth (no org isolation)
