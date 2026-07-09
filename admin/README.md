# Insights / Blog CMS

A free, git-based publishing setup for the Insights section. Marketing edits Markdown in
a browser UI (Decap CMS); a Python build step renders it into on-brand static HTML.

## How it fits together

```
admin/ (Decap CMS)  →  insights/*.md  →  build_insights.py  →  pivotpath-insight-<slug>.html
                                                              →  cards in pivotpath-insights.html
                                              build.py        →  shared nav/footer injected
```

- **Content** lives as one Markdown file per post in `insights/`, with YAML frontmatter
  (schema mirrors `content-engine/playbooks/blog-spec.md` + a `category` field).
- **`tooling/build_insights.py`** renders every `status: published` post into
  `pivotpath-insight-<slug>.html`, injects the shared nav/footer (reusing `build.py`'s
  partials), and regenerates the card grid on `pivotpath-insights.html`. It is
  **self-contained and idempotent** — one command, and it only touches insight pages +
  the index (never other pages). You do *not* need to run `build.py` for a normal publish;
  run `build.py` only when you change the sitewide nav/footer partials themselves.

## Publish a post (current workflow — you publish to GitHub)

```bash
pip install -r tooling/requirements.txt         # once: markdown + PyYAML
# ...author or edit insights/<slug>.md, set status: published...
python3 tooling/build_insights.py               # render posts + nav + refresh the grid
git add -A && git commit -m "Publish: <title>" && git push   # GitHub Pages deploys
```

Preview flags: `build_insights.py --check` (dry run) · `--drafts` (also render drafts locally).

## Test the editor locally (no GitHub, no login)

```bash
npx decap-server      # terminal 1 — local git proxy on :8081
python3 -m http.server 8000   # terminal 2 — serve the site
# open http://localhost:8000/admin/  → edit → saves write to insights/*.md
```

`local_backend: true` in `admin/config.yml` enables this offline mode.

## Production (AWS) — deferred to cut-over

- Set `local_backend: false`; keep the `backend:` block (GitHub / git-gateway).
- Gate the `/admin/` route behind **Microsoft Entra ID** via CloudFront + Lambda@Edge OIDC
  (real "Sign in with Microsoft", MFA/Conditional Access). Marketers never need GitHub
  accounts — commits go through a bot/git-gateway identity; Entra controls access.

## Grounding rule (non-negotiable)

The build only renders — it never invents facts. Every stat must trace to
`docs/CAPABILITIES.md §6`. See `content-engine/playbooks/blog-spec.md` for the full editorial spec.
