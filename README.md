# CivilPYQ

![image](https://github.com/user-attachments/assets/9cf230eb-79c7-4bcc-b89b-02813f476a55)

CivilPYQ is a full-stack study platform for civil engineering students — a fast, mobile-first library of past year question papers, lab manuals, and syllabi, built around a custom multi-window PDF workspace and a Gemini-powered AI layer for solving, summarizing, and predicting exam questions directly from the source material.

## Highlights

- 🪟 **Multi-Window PDF Workspace** – Open several question papers or manuals side by side in draggable, resizable windows with taskbar-style minimize/restore, instead of the usual single-tab PDF viewer.
- 🤖 **AI Study Layer, Powered by Gemini** – Get step-by-step problem solutions, chat with the AI about the exact PDF you're reading, generate revision notes, and surface high-probability topics from historical question trends — all reading the actual document content, not just its title.
- 🔍 **Fast, Zoomable PDF Rendering** – PDF.js-based viewer tuned for quick loads even on slow connections.
- 📚 **Structured Resource Library** – Papers, lab manuals, and syllabi organized by semester and subject, always up to date.
- 🤝 **Community Contribution Pipeline** – Students can submit resources directly from the site, protected against spam and abuse.
- 📁 **CDN-Backed File Delivery** – Files are served through a GitHub + jsDelivr pipeline for fast, reliable global delivery.
- 📴 **Installable & Offline-Ready** – Add CivilPYQ to your home screen like a native app, and keep previously opened papers available in an offline library even without a connection.
- 🎨 **Polished, Responsive UI** – Dark theme, fluid transitions, and a layout that holds up from phone to desktop.

## AI Features

CivilPYQ's AI tools run on Gemini and are built to actually understand the PDF a student is looking at, not just answer generically:

- 🚀 **Dual-Mode Solver** – A heavier "Pro" mode for multi-step structural/numerical problems, and a fast, lightweight mode for quick conceptual questions — switchable per query.
- 📈 **Exam Question Predictor** – Analyzes patterns across previous years' papers for a subject to surface the topics most likely to reappear.
- 💬 **Document-Aware Chat** – A persistent chat that reads the specific PDF in view, so answers are grounded in that exact paper or manual rather than general knowledge.
- 📄 **Instant Summarization** – Turns long PDFs into concise revision notes and formula sheets on demand.
- 🔑 **Zero-Cost, Bring-Your-Own-Key Model** – Each visitor uses their own free-tier Gemini API key (stored locally in their browser only), so the AI features run at no cost to the project and scale with usage instead of hitting a shared quota.

## Tech Stack

- **Frontend**: React, Vite
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Styling**: CSS Modules
- **Icons**: Material UI Icons
- **PDF Viewer**: react-pdf (PDF.js)
- **Animation**: CSS Transitions
- **File Delivery**: GitHub + jsDelivr CDN
- **Hosting**: Netlify [Visit CivilPYQ](https://civilpyq.netlify.app)

## Installation

1. Requires Node.js 18 or later.

2. Clone the repository:
   ```bash
   git clone https://github.com/sigalium/civilpyq.git
   cd civilpyq
   npm install
   ```

3. Set up environment variables for the frontend. Create a `.env.local` in the project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_JSDELIVR_OWNER=your-github-username
   VITE_JSDELIVR_REPO=civil-pyq-pdf
   VITE_JSDELIVR_BRANCH=main
   ```
   `VITE_JSDELIVR_OWNER`, `VITE_JSDELIVR_REPO` and `VITE_JSDELIVR_BRANCH` must match the GitHub repo the dashboard publishes files into (see below).

4. Run the dev server:
   ```bash
   npm run dev
   ```

## Database Setup

The full schema — tables, Row Level Security policies, triggers, and audit logging — lives in a single file: `supabase/schema.sql`. Run it once against your Supabase project's SQL editor to set everything up; it's written to be safe to re-run (uses `if not exists`, `create or replace`, and exception-safe policy creation), so re-running it after a schema update won't wipe existing data.

After running the schema, set your own account as the initial owner by updating the seed insert at the bottom of `schema.sql` with your email before running it, or by manually updating the `admins` table afterward:

```sql
update admins set role = 'owner' where email = 'you@example.com';
```

### Dashboard & Admin Roles

The `/dashboard` route is protected and only accessible to signed-in Google accounts present in the `admins` table. There are two role tiers:

- **Owner** – full access to everything, including deleting resources/subjects/contributors permanently, managing other admins' permissions, and deleting audit log entries. Only one or more owners can grant/revoke `can_edit_members`.
- **Admin** – granular permissions set per-admin: `can_review_submissions`, `can_edit_resources`, `can_delete_resources`, `can_view_trash`, `can_view_audit_log`, `can_view_members`, `can_edit_members`, `can_manage_contributors`, `can_view_analytics`, `can_manage_settings`.
- **Developer** – a separate `is_developer` permission (not a role), toggled per-admin like the others. It only controls access to maintenance mode inside the Settings tab; an admin can have `can_manage_settings` without `is_developer` and still see the Settings tab, just without the maintenance-mode controls.

Every meaningful change made through the dashboard (approving submissions, editing resources, reordering, managing contributors, changing member permissions) is recorded in the `audit_log` table and viewable under the Audit Log tab. Reordering/drag-and-drop changes are intentionally excluded from the log to avoid noise — only actual content changes are recorded.

### Dashboard Tabs

- **Submissions** – review and approve/reject student-submitted PDFs
- **Resources** – manage subjects and resources per semester, plus the academic calendar and per-semester syllabus links
- **Upload** – upload multiple resources at once
- **Migration** – tools for moving/relinking existing files
- **Contributors** – manage the student/faculty contributor list shown on the Contribute page
- **Trash** – soft-deleted resources/subjects/contributors, restorable within 30 days before permanent purge
- **Members** – manage admin accounts and their permissions (owner-only editing)
- **Audit Log** – full activity history; owners can delete individual entries, delete a selection, or empty the log entirely
- **Analytics** – most-viewed/most-downloaded files (filterable by type and date range), storage breakdown, and a view/download trend chart
- **Settings** – site-wide toggles: analytics demo mode (owner-only), pausing new submissions, and maintenance mode (owner/developer-only)

## Automated Publishing Pipeline

Everything uploadable from the dashboard (submission approvals, resource PDFs, contributor photos, the academic calendar) is pushed straight to a GitHub repo and served through jsDelivr's CDN. No manual `git push` step is needed.

How it works:

- The dashboard uploads a file through the `github-upload` Supabase Edge Function.
- The function checks that the caller is a signed-in admin with edit rights.
- It commits the file to the configured GitHub repo using the GitHub Contents API.
- It then calls jsDelivr's purge endpoint so the CDN link is live within seconds instead of waiting on cache TTL.
- The resulting `https://cdn.jsdelivr.net/...` URL is what gets stored in Supabase.

### One-time setup

1. Create a fine-grained GitHub Personal Access Token scoped only to your PDF/asset repo (e.g. `civil-pyq-pdf`), with **Contents: Read and write** permission.

2. Set the following secrets on your Supabase project (Project Settings → Edge Functions → Secrets, or via the CLI):
   ```bash
   supabase secrets set GITHUB_TOKEN=github_pat_xxxxxxxx
   supabase secrets set GITHUB_OWNER=your-github-username
   supabase secrets set GITHUB_REPO=civil-pyq-pdf
   supabase secrets set GITHUB_BRANCH=main
   ```
   `GITHUB_OWNER`, `GITHUB_REPO` and `GITHUB_BRANCH` must exactly match the `VITE_JSDELIVR_*` values used by the frontend, otherwise the URLs stored in the database won't resolve.

3. Deploy the function:
   ```bash
   supabase functions deploy github-upload
   ```

4. Make sure every admin who should be able to publish files has one of `can_review_submissions`, `can_edit_resources`, or `can_manage_contributors` set to `true` in the `admins` table (or `role = 'owner'`).

Once this is set up, approving a submission, adding a resource, uploading a contributor photo, or replacing the academic calendar in the dashboard all publish directly to GitHub and the CDN — there is no separate manual step.

## Edge Functions

| Function | Purpose |
|---|---|
| `submit-resource` | Handles student PDF submissions from the Contribute page, using the service role key so no public write access to the database is needed |
| `github-upload` | Publishes an approved/edited file to the GitHub repo and purges the jsDelivr cache, as described above |
| `github-delete` | Removes a file from the GitHub repo (restricted to the `pdfs/` and `Contributor/` paths) when a resource or contributor photo is permanently deleted |
| `migrate-file` | Used by the dashboard's Migration tab to move or relink existing resource files |
| `scan-file` | Scans uploaded files before they're accepted, used by Submissions, Resources, Bulk Upload, and Contributors tabs |
| `backfill-file-sizes` | Fills in file sizes for older resources that don't have one recorded yet, by looking the file up on GitHub. Safe to run more than once |

## AI Features (Bring Your Own Key)

The AI Chat and Exam Predictor widgets run entirely client-side against the Gemini API using an API key the visitor provides themselves (free at [aistudio.google.com](https://aistudio.google.com/apikey)) — this keeps the site free to run for the project owner, since every visitor uses their own free-tier Gemini quota rather than a shared key. The key is stored in the browser's `localStorage`/`sessionStorage` only and never touches Supabase.

Both widgets show a running count of requests made that day per saved key, and the Exam Predictor will offer to reopen a previous chat for a subject if one was already saved in that browser.