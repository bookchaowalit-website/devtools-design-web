# Design Specs (star atlas)

A browser-only text catalogue of design work: each work has a title, type (Branding, UI/UX, Editorial, Art
direction, Research), tools and a status (Draft, In review, Approved). Two seed works come from `data/works.json`;
works you add, re-state or remove live in this browser's `localStorage`, with JSON export and import. There are no
images.

Live: https://design.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does

- Add a work (title up to 80 characters, up to 8 comma-separated tools, de-duplicated ignoring case).
- Search by title, type, tool or status; change status; remove; count of approved works.
- Export the catalogue as JSON and import a backup (validated, BOM-tolerant, merged by id).
- `/api/mcp` JSON-RPC tools over the published seed catalogue: `get_all`, `get_by_id`, `search`.

## What it does not do

- No image gallery, lazy loading, lightbox, CDN or uploads. No account or sync.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: catalogue rules + import/export, MCP handler + route, site origin, home render, Sentry
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Configuration

- `NEXT_PUBLIC_SITE_URL` (optional): canonical origin. Defaults to `https://design.bookchaowalit.com`.
- `NEXT_PUBLIC_SENTRY_DSN` (optional): turns on error reporting; unset means Sentry is off.

## Code map

- `data/works.json` + `lib/catalogue.ts`: the published seed works.
- `lib/works.ts`: work rules, tool parsing, search, status, stored-data repair, JSON export/import.
- `lib/mcp.ts` + `app/api/mcp/route.ts`: stateless JSON-RPC endpoint over the seed catalogue.
- `lib/site.ts`: canonical origin.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped.
- `app/more-projects/page.tsx`: portfolio link page (copied per repository, not a package).
