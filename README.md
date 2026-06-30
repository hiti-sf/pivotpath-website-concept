# Pivot Path — Website Redesign Preview

Static HTML preview of the Pivot Path website redesign (Databricks-style rework).
No build step, no server — every page is plain HTML linking one shared stylesheet
(`pp.css`) and Bootstrap from a CDN.

## View locally

Open `index.html` in any browser.

## Publish on GitHub Pages

1. Create a new GitHub repo and upload **the contents of this folder** (so `index.html`
   sits at the repo root).
2. In the repo: **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**, **Branch = `main`**, **Folder = `/ (root)`**, then **Save**.
4. Wait ~1 minute. Your site is live at `https://<your-username>.github.io/<repo-name>/`.
   Share that link with colleagues.

The `.nojekyll` file is intentional — it tells GitHub Pages to serve the files as-is
(no Jekyll processing).

## What's here

- `index.html` — homepage (entry point)
- `pivotpath-*.html` — all other pages (services, products, case studies, leadership, platforms)
- `pp.css` — single shared stylesheet (all styling lives here)
- `pp-logo-black.svg` / `pp-logo-white.svg` — logos
- `assets/` — product logos and leadership headshots

## Note

Internet access is required when viewing — Bootstrap loads from a CDN.
The "LinkedIn" icons on leadership cards are placeholder links (`#`) pending real profile URLs.
