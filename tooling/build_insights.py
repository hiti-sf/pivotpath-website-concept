#!/usr/bin/env python3
"""Render Pivot Path insights/blog markdown into published static HTML pages.

This is the markdown->HTML publishing bridge for the Insights section. Marketing
authors (or the content-engine pipeline) produce one Markdown file per post under
`insights/`, carrying the YAML frontmatter schema from
`content-engine/playbooks/blog-spec.md` plus a `category` field. This script:

  1. Scans `insights/*.md`, keeping only `status: published` posts.
  2. Renders each into `pivotpath-insight-{slug}.html` at the repo root, matching the
     site's `<head>` boilerplate (Bootstrap CDN, pp.css cache-bust, analytics/CRM),
     the build.py-managed header/footer regions, a `.page-hero` and an article body,
     plus BlogPosting + BreadcrumbList JSON-LD.
  3. Regenerates the `<!-- INSIGHTS:GENERATED -->...<!-- /INSIGHTS:GENERATED -->`
     card region inside `#insights-grid` on `pivotpath-insights.html` from every
     published post (lighting up the Blog / Use Cases / News filter tabs), leaving
     the hand-coded case-study cards untouched.

The generated pages carry stub header/footer regions; run `python3 tooling/build.py`
AFTER this script so the shared nav/footer + active-state are injected.

The renderer only renders — it never invents facts. Grounding (no fabricated stats)
is enforced upstream in the Markdown per docs/CAPABILITIES.md and blog-spec.md.

Usage:
    python3 tooling/build_insights.py            # render all published posts + grid
    python3 tooling/build_insights.py --check     # dry-run: report changes, write nothing
    python3 tooling/build_insights.py --drafts    # also render status: draft (local preview)
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path
from typing import Callable, Dict, List, Tuple

import markdown
import yaml

# The insight pages carry the same shared nav/footer as the rest of the site. Rather than
# leave stub regions and require a second `build.py` pass (which also re-touches unrelated
# pages), we reuse build.py's renderers to inject the final header/footer here — so publishing
# is one self-contained command that only ever writes insight pages + the index.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build as sitebuild  # noqa: E402  (tooling/build.py; aliased to avoid our build() fn)

ROOT = Path(__file__).resolve().parent.parent          # repo root (site)
INSIGHTS_DIR = ROOT / "insights"
INDEX_PAGE = ROOT / "pivotpath-insights.html"
SITE_URL = "https://pivotpath.com"
PAGE_PREFIX = "pivotpath-insight-"

GEN_START = "<!-- INSIGHTS:GENERATED -->"
GEN_END = "<!-- /INSIGHTS:GENERATED -->"
GEN_RE = re.compile(re.escape(GEN_START) + r".*?" + re.escape(GEN_END), re.DOTALL)

# Human-facing labels. Category drives the #insights-grid data-cat filter.
CATEGORY_LABELS: Dict[str, str] = {
    "case-study": "Case Study",
    "use-case": "Use Case",
    "blog": "Blog",
    "news": "News",
}
# service_line values per blog-spec.md §2.1 -> live pillar labels (CLAUDE.md).
SERVICE_LINE_LABELS: Dict[str, str] = {
    "patient-safety": "Patient Safety",
    "digital-transformation": "Digital Transformation",
    "human-capital": "Human Capital",
    "ip-clinical": "IP & Clinical",
    "quality-compliance": "Quality & Compliance",
}
READ_VERB: Dict[str, str] = {
    "case-study": "Read the story",
    "use-case": "Read the use case",
    "blog": "Read the article",
    "news": "Read more",
}

FRONTMATTER_RE = re.compile(r"^\s*---\s*\n(.*?)\n---\s*\n?(.*)$", re.DOTALL)


def parse_frontmatter(text: str) -> Tuple[Dict, str]:
    """Split a Markdown file into (frontmatter dict, body).

    Args:
        text: Full file contents, expected to open with a YAML `---` fence.

    Returns:
        (meta, body). meta is {} if no valid frontmatter fence is present.
    """
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    meta = yaml.safe_load(m.group(1)) or {}
    if not isinstance(meta, dict):
        meta = {}
    return meta, m.group(2)


def detect_css_version() -> str:
    """Read the current pp.css?v=N token from the insights index (fallback: bare)."""
    try:
        m = re.search(r"pp\.css\?v=(\d+)", INDEX_PAGE.read_text())
        if m:
            return f"?v={m.group(1)}"
    except OSError:
        pass
    return ""


def _attr(value: str) -> str:
    """Escape a string for use inside an HTML attribute."""
    return html.escape(str(value), quote=True)


def slug_to_page(slug: str) -> str:
    """Return the output filename for a post slug."""
    return f"{PAGE_PREFIX}{slug}.html"


def tag_line(meta: Dict) -> str:
    """Build the card/eyebrow tag, e.g. 'Blog · Patient Safety'."""
    cat = CATEGORY_LABELS.get(meta.get("category", "blog"), "Blog")
    sl = SERVICE_LINE_LABELS.get(meta.get("service_line", ""))
    return f"{cat} · {sl}" if sl else cat


def json_ld(meta: Dict, url: str) -> str:
    """Build the BlogPosting + BreadcrumbList JSON-LD block for a post."""
    org = {
        "@type": "Organization",
        "@id": f"{SITE_URL}/#organization",
        "name": "Pivot Path",
        "url": f"{SITE_URL}/",
    }
    posting = {
        "@type": "BlogPosting",
        "headline": meta.get("title", ""),
        "description": meta.get("meta_description", meta.get("excerpt", "")),
        "author": org,
        "publisher": org,
        "mainEntityOfPage": url,
        "url": url,
    }
    if meta.get("date"):
        posting["datePublished"] = str(meta["date"])
    breadcrumb = {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE_URL}/"},
            {"@type": "ListItem", "position": 2, "name": "Insights",
             "item": f"{SITE_URL}/pivotpath-insights.html"},
            {"@type": "ListItem", "position": 3, "name": meta.get("title", ""), "item": url},
        ],
    }
    graph = {"@context": "https://schema.org", "@graph": [posting, breadcrumb]}
    return json.dumps(graph, indent=2, ensure_ascii=False)


def render_post(meta: Dict, body_html: str, css: str) -> str:
    """Assemble a full insight page from frontmatter + rendered body HTML."""
    title = meta.get("title", "Untitled")
    meta_title = meta.get("meta_title") or f"{title} | Pivot Path"
    description = meta.get("meta_description") or meta.get("excerpt", "")
    lead = meta.get("excerpt") or description
    cat_label = CATEGORY_LABELS.get(meta.get("category", "blog"), "Blog")
    url = f"{SITE_URL}/{slug_to_page(meta['slug'])}"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{_attr(meta_title)}</title>
  <meta name="description" content="{_attr(description)}" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
  <link rel="stylesheet" href="pp.css{css}" />
  <script type="application/ld+json">
{json_ld(meta, url)}
  </script>
  <script src="pp-analytics.js"></script>
  <!-- Freshworks (Freshmarketer / Freshchat) -->
  <script src="//in.fw-cdn.com/32228802/1191962.js" chat="true"></script>
  <script src="pp-crm.js"></script>
</head>
<body>
  <div class="pp-topbar"></div>

  <!-- ============ HEADER ============ -->
  <header></header>

  <!-- ============ PAGE HERO ============ -->
  <section class="page-hero pad80">
    <div class="container">
      <div class="crumb"><a href="pivotpath-home.html">Home</a> &nbsp;/&nbsp; <a href="pivotpath-insights.html">Insights</a> &nbsp;/&nbsp; {_attr(cat_label)}</div>
      <h1>{_attr(title)}</h1>
      <p class="lead">{_attr(lead)}</p>
    </div>
  </section>

  <!-- ============ ARTICLE ============ -->
  <section class="pad80">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <article class="pp-article reveal">
{body_html}
          </article>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ FINAL CTA ============ -->
  <section class="pad80 final-cta text-center" id="contact">
    <div class="container">
      <h2 class="section-title text-white reveal mb-3">Bring us the workload.</h2>
      <p class="text-white-50 reveal mb-4" style="max-width:640px;margin-inline:auto">Tell us the problem and we&rsquo;ll map it to the right capability, platform or team &mdash; and run it with you.</p>
      <div class="hero-ctas justify-content-center reveal">
        <a href="mailto:info@pivotpath.com" class="btn-pill btn-pill-light">Talk to our experts</a>
        <a href="pivotpath-insights.html" class="btn-pill btn-pill-ghost">Back to Insights</a>
      </div>
    </div>
  </section>

  <!-- ============ FOOTER ============ -->

  <footer></footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    (function(){{
      var io=new IntersectionObserver(function(es){{es.forEach(function(e){{if(e.isIntersecting){{e.target.classList.add('in');io.unobserve(e.target);}}}});}},{{threshold:.12}});
      document.querySelectorAll('.reveal').forEach(function(el){{io.observe(el);}});
    }})();
  </script>
  <script src="pp-mobile.js" defer></script>
</body>
</html>
"""


def render_card(meta: Dict) -> str:
    """Build one .story-card for the insights grid from a post's frontmatter."""
    cat = meta.get("category", "blog")
    verb = READ_VERB.get(cat, "Read more")
    excerpt = meta.get("excerpt") or meta.get("meta_description", "")
    return (
        f'        <div class="col-md-4 reveal" data-cat="{_attr(cat)}">\n'
        f'          <a href="{_attr(slug_to_page(meta["slug"]))}" class="story-card">\n'
        f'            <span class="story-tag">{_attr(tag_line(meta))}</span>\n'
        f'            <span class="story-metric">{_attr(meta.get("title", ""))}</span>\n'
        f'            <span class="story-cap">{_attr(excerpt)}</span>\n'
        f'            <span class="story-go">{_attr(verb)} <span aria-hidden="true">→</span></span>\n'
        f"          </a>\n"
        f"        </div>"
    )


def make_nav_injector() -> Callable[[str, str], str]:
    """Return inject(html, page) that swaps the stub header/footer regions for the shared
    nav/footer, using build.py's single-source partials + per-page hooks."""
    header = (sitebuild.PARTIALS / "header.html").read_text()
    footer = (sitebuild.PARTIALS / "footer.html").read_text()
    head_hrefs, sub_to_head = sitebuild._mega_maps(header)
    product_hrefs = set(re.findall(r'<a class="dropdown-item" href="([^"]+)"', header))

    def inject(page_html: str, page: str) -> str:
        page_html = sitebuild.HEADER_RE.sub(
            lambda _m: sitebuild.render_header(header, page, head_hrefs, sub_to_head, product_hrefs),
            page_html, count=1)
        page_html = sitebuild.FOOTER_RE.sub(
            lambda _m: sitebuild.render_footer(footer, page), page_html, count=1)
        return page_html

    return inject


def load_posts(include_drafts: bool) -> List[Tuple[Path, Dict, str]]:
    """Load and validate all insight Markdown files. Returns (path, meta, body)."""
    posts: List[Tuple[Path, Dict, str]] = []
    if not INSIGHTS_DIR.exists():
        return posts
    for path in sorted(INSIGHTS_DIR.glob("*.md")):
        meta, body = parse_frontmatter(path.read_text())
        if not meta.get("slug") or not meta.get("title"):
            print(f"  skipped (missing slug/title): {path.name}", file=sys.stderr)
            continue
        status = str(meta.get("status", "draft")).lower()
        if status != "published" and not include_drafts:
            continue
        posts.append((path, meta, body))
    return posts


def update_grid(posts: List[Tuple[Path, Dict, str]], check: bool) -> bool:
    """Replace the generated-card region on the insights index. Returns True if changed."""
    text = INDEX_PAGE.read_text()
    if not GEN_RE.search(text):
        print(f"  ERROR: {INDEX_PAGE.name} is missing the "
              f"{GEN_START} ... {GEN_END} markers inside #insights-grid.", file=sys.stderr)
        return False
    cards = "\n".join(render_card(meta) for _p, meta, _b in posts)
    inner = f"{GEN_START}\n{cards}\n        {GEN_END}" if cards else f"{GEN_START}\n        {GEN_END}"
    new = GEN_RE.sub(lambda _m: inner, text, count=1)
    if new == text:
        return False
    if not check:
        INDEX_PAGE.write_text(new)
    print(f"  {'would update' if check else 'updated'}: {INDEX_PAGE.name} "
          f"({len(posts)} generated card(s))")
    return True


def build(check: bool, include_drafts: bool) -> int:
    """Render every (published) post + refresh the grid. Returns count of pages written."""
    css = detect_css_version()
    md = markdown.Markdown(extensions=["extra", "sane_lists", "smarty"])
    inject = make_nav_injector()
    posts = load_posts(include_drafts)

    written = 0
    for _path, meta, body in posts:
        md.reset()
        body_html = md.convert(body)
        page = slug_to_page(meta["slug"])
        page_html = inject(render_post(meta, body_html, css), page)
        out = ROOT / page
        existing = out.read_text() if out.exists() else None
        if page_html != existing:
            written += 1
            if check:
                print(f"  would write: {out.name}")
            else:
                out.write_text(page_html)
                print(f"  wrote: {out.name}")

    update_grid(posts, check)
    print(f"\n{len(posts)} published post(s); {written} page(s) "
          f"{'would change' if check else 'written'}.")
    return written


def main() -> None:
    ap = argparse.ArgumentParser(description="Render insights Markdown into static HTML pages.")
    ap.add_argument("--check", action="store_true", help="dry-run: report changes, write nothing")
    ap.add_argument("--drafts", action="store_true",
                    help="also render status: draft posts (local preview)")
    args = ap.parse_args()
    build(args.check, args.drafts)


if __name__ == "__main__":
    main()
