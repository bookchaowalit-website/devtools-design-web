# Design Specs — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `design`, evidence Live→Prototype: the masonry
> image gallery, lazy loading, lightbox, Cloudflare CDN and 50+ images were removed) on 2026-10-23.

## What it is

A client-only text catalogue of design work styled as a star atlas, seeded with two works from `data/works.json`.

## Who it is for

A designer keeping a short list of projects with their tools and review state, and a portfolio visitor.

## What works today

1. Two seed works (Brand Identity, UI Design). Add a work with a title (≤ 80), type, up to 8 tools (comma-separated,
   de-duplicated ignoring case) and status Draft, In review or Approved.
2. Search by title, type, tool or status; change status; remove a work; the sky panel counts points and approvals.
3. Export the catalogue as versioned JSON; import a backup (validated, BOM-tolerant, merged by id, with a notice).
4. Saved data is repaired on load (bad JSON, unknown statuses, overlong text).
5. `/api/mcp` answers JSON-RPC with `get_all`, `get_by_id` and `search` over the published seed works; works added
   in a browser are never visible to it. Unknown tools and methods return JSON-RPC errors.
6. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No images at all: no gallery, lazy loading, lightbox, CDN or uploads.
- No account, sharing or sync; clearing site data deletes added works unless exported.

## Live URL and deploy state

- Live: https://design.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-design-frontend` is deployed by CLI only. Its Git link names the old repository
  (`bookchaowalit/bookchaowalit-design-frontend`), so a push to `main` does not deploy. The last production deploy is
  2026-10-08 (CLI, commit 3265953), which still has the 436px-wide home page at 375: the CVE patch deploy did not run
  because Vercel's free plan hit its 100-deployments/day limit on 2026-10-23. The coordinator deploys the latest green
  `main` after the quota resets; reconnecting Vercel Git to this repository is owner action D9.
- `NEXT_PUBLIC_SENTRY_DSN` is set on the Vercel project (Sentry project `devtools-design-web`, org `personal-yu0`); it
  takes effect on the next deploy.

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route. No server storage, no personal data collected.
