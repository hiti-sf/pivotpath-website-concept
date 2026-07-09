#!/usr/bin/env python3
"""Assemble the shared header (nav + Services mega-menu) and footer into every
Pivot Path page from single-source partials.

The navbar and footer used to be hand-duplicated in all 39 HTML pages. They now
live once in tooling/partials/{header,footer}.html; this script renders them into
each page — applying the small per-page hooks (active mega-menu pillar, CTA label,
brand href, active nav-link, footer variant) — and writes the result back in place.
Output is byte-identical to the previous hand-authored site on first run (verify
with `git diff` == empty), so it is safe to re-run any time.

Edit workflow:
    1. Edit tooling/partials/header.html or tooling/partials/footer.html
    2. python3 tooling/build.py
    3. git add -A && commit

Usage:
    python3 tooling/build.py              # render header+footer into all pages
    python3 tooling/build.py --check      # dry-run: report which pages would change, write nothing
    python3 tooling/build.py --limit 5    # process only the first 5 pages (quick test)
    python3 tooling/build.py --bump-css 6 # rewrite the pp.css?v=N cache-bust token across all pages
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

ROOT = Path(__file__).resolve().parent.parent          # repo root (site)
PARTIALS = Path(__file__).resolve().parent / "partials"

HEADER_RE = re.compile(r'<div class="pp-topbar"></div>.*?</header>', re.DOTALL)
FOOTER_RE = re.compile(r'<!-- =+ FOOTER =+ -->.*?</footer>', re.DOTALL)

# ----- Per-page hooks (captured from the current site; see docs / build plan) -----
# Product-context pages: the "Products" dropdown toggle is a bare "#" opener here (on other
# sub-pages it points to pivotpath-home.html#platforms). The nav CTA is uniformly
# "Talk to our experts" on every page — see tooling/partials/header.html.
PRODUCT_TOGGLE_PAGES: Set[str] = {
    "pivotpath-arete.html", "pivotpath-ai-trust.html", "pivotpath-anomiq.html",
    "pivotpath-golanzar.html", "pivotpath-inlumin.html", "pivotpath-insights.html",
    "pivotpath-investigationiq.html", "pivotpath-leadership.html",
    "pivotpath-noteiq-dms.html", "pivotpath-noteiq-regintel.html",
    "pivotpath-noteiq-tms.html", "pivotpath-noteiq-vms.html", "pivotpath-noteiq.html",
    "pivotpath-platforms.html", "pivotpath-novavigil.html",
}
# The two homepages. They use RELATIVE in-page anchors (#services, #platforms, #why, #about,
# #clients) and a brand href of "#"; every other page is a sub-page that rewrites those anchors to
# point back at the homepage's sections (pivotpath-home.html#...) and links the brand to the homepage.
HOMEPAGE: Set[str] = {"index.html", "pivotpath-home.html"}
# Pages that mark a top-level nav-link active -> {page: href of the link to activate}.
NAVLINK_ACTIVE: Dict[str, str] = {
    "pivotpath-ai-trust.html": "pivotpath-ai-trust.html",
    "pivotpath-insights.html": "pivotpath-insights.html",
    "pivotpath-identity-user-management.html": "pivotpath-insights.html",
    "pivotpath-pharma-4-0.html": "pivotpath-insights.html",
    "pivotpath-zero-touch-it.html": "pivotpath-insights.html",
}
# Footer variants.
FOOTER_PLATFORMS: Set[str] = {"index.html"}                       # col-3 header "Platforms" vs "Products"
# Tagline is uniformly "…from molecule to launch." sitewide (client decision 2026-07); set in footer.html.


def _mega_maps(header: str) -> Tuple[Set[str], Dict[str, str]]:
    """Derive the mega-menu structure from the header partial.

    Returns (set of mega-head hrefs, mapping of mega-sub href -> its column's head href),
    so a page's active pillar/sub can be derived from its own filename with no config.
    """
    head_hrefs: Set[str] = set()
    sub_to_head: Dict[str, str] = {}
    for col in re.findall(r'<div class="mega-col">(.*?)</div>', header, re.DOTALL):
        head_m = re.search(r'<a class="mega-head" href="([^"]+)"', col)
        if not head_m:
            continue
        head = head_m.group(1)
        head_hrefs.add(head)
        for sub in re.findall(r'<a class="mega-sub" href="([^"]+)"', col):
            sub_to_head[sub] = head
    return head_hrefs, sub_to_head


def render_header(header: str, page: str, head_hrefs: Set[str], sub_to_head: Dict[str, str],
                  product_hrefs: Set[str]) -> str:
    """Return the header partial with this page's per-page hooks applied."""
    h = header
    # Homepage vs sub-page: brand href + in-page anchor targets
    if page in HOMEPAGE:
        h = h.replace('<a class="navbar-brand p-0" href="pivotpath-home.html">',
                      '<a class="navbar-brand p-0" href="#">')
    else:
        # Services toggle is a pure dropdown opener on every sub-page; Why-Us points home.
        h = h.replace('href="#services"', 'href="#"')
        h = h.replace('href="#why"', 'href="pivotpath-home.html#why"')
        # Products toggle: pure opener on product-context pages, else points home.
        if page in PRODUCT_TOGGLE_PAGES:
            h = h.replace('href="#platforms"', 'href="#"')
        else:
            h = h.replace('href="#platforms"', 'href="pivotpath-home.html#platforms"')
    # Active Products dropdown-item (product pages -> self; NoteIQ modules -> the NoteIQ hub)
    active_item = None
    if page in product_hrefs:
        active_item = page
    elif page.startswith("pivotpath-noteiq-"):
        active_item = "pivotpath-noteiq.html"
    if active_item:
        h = h.replace(f'<a class="dropdown-item" href="{active_item}">',
                      f'<a class="dropdown-item active" href="{active_item}">')
    # Active mega-head (page is a pillar page)
    if page in head_hrefs:
        h = h.replace(f'<a class="mega-head" href="{page}">',
                      f'<a class="mega-head active" href="{page}">')
    # Active mega-sub (page is a sub-service) + its column head
    if page in sub_to_head:
        h = h.replace(f'<a class="mega-sub" href="{page}">',
                      f'<a class="mega-sub active" href="{page}">')
        head = sub_to_head[page]
        h = h.replace(f'<a class="mega-head" href="{head}">',
                      f'<a class="mega-head active" href="{head}">')
    # Active top-level nav-link (generated insight/blog pages also activate Insights)
    target = NAVLINK_ACTIVE.get(page)
    if target is None and page.startswith("pivotpath-insight-"):
        target = "pivotpath-insights.html"
    if target:
        h = h.replace(f'class="nav-link" href="{target}"',
                      f'class="nav-link active" href="{target}"')
    return h


def render_footer(footer: str, page: str) -> str:
    """Return the footer partial with this page's per-page hooks applied."""
    f = footer
    # Sub-pages point the homepage-section footer links back at the homepage.
    if page not in HOMEPAGE:
        f = f.replace('href="#about"', 'href="pivotpath-home.html#about"')
        f = f.replace('href="#clients"', 'href="pivotpath-home.html#clients"')
    if page in FOOTER_PLATFORMS:
        f = f.replace('<h6>Products</h6>', '<h6>Platforms</h6>')
    return f


# Pages that live in a sub-directory (their asset/link paths need a `../` prefix — see _reroot()).
SUBDIR_PAGES = ("eu/index.html",)


def pages() -> List[Path]:
    root = sorted(ROOT.glob("*.html"))
    sub = [ROOT / p for p in SUBDIR_PAGES if (ROOT / p).exists()]
    return root + sub


def _reroot(html: str, prefix: str) -> str:
    """Prefix root-relative internal links/assets (pivotpath-*, pp-*, assets/) with `prefix`
    (e.g. `../`) so the shared root-relative partials work for pages in a sub-directory.
    No-op for root pages (prefix == '')."""
    if not prefix:
        return html
    return re.sub(r'(href|src)="(pivotpath-|pp-|assets/)',
                  lambda m: f'{m.group(1)}="{prefix}{m.group(2)}', html)


def build(check: bool, limit: int | None) -> int:
    header = (PARTIALS / "header.html").read_text()
    footer = (PARTIALS / "footer.html").read_text()
    head_hrefs, sub_to_head = _mega_maps(header)
    product_hrefs = set(re.findall(r'<a class="dropdown-item" href="([^"]+)"', header))

    targets = pages()
    if limit:
        targets = targets[:limit]

    changed = 0
    skipped: List[str] = []
    for path in targets:
        rel = path.relative_to(ROOT)
        page = rel.as_posix()                       # "index.html" or "eu/index.html" — unique key
        prefix = "../" * (len(rel.parts) - 1)       # "" for root pages, "../" one level deep
        text = path.read_text()
        if not (HEADER_RE.search(text) and FOOTER_RE.search(text)):
            skipped.append(page)
            continue
        new = HEADER_RE.sub(
            lambda _m: _reroot(render_header(header, page, head_hrefs, sub_to_head, product_hrefs), prefix),
            text, count=1)
        new = FOOTER_RE.sub(lambda _m: _reroot(render_footer(footer, page), prefix), new, count=1)
        if new != text:
            changed += 1
            if check:
                print(f"  would update: {page}")
            else:
                path.write_text(new)
                print(f"  updated: {page}")

    if skipped:
        print(f"\n  skipped (no header/footer region): {', '.join(skipped)}", file=sys.stderr)
    verb = "would change" if check else "changed"
    print(f"\n{changed} file(s) {verb}; {len(targets) - changed - len(skipped)} already current; "
          f"{len(skipped)} skipped.")
    return changed


def bump_css(version: int, check: bool) -> int:
    """Rewrite pp.css?v=N across all pages (safe single-token replacement)."""
    pat = re.compile(r'pp\.css\?v=\d+')
    repl = f"pp.css?v={version}"
    changed = 0
    for path in pages():
        text = path.read_text()
        new, n = pat.subn(repl, text)
        if n and new != text:
            changed += 1
            if not check:
                path.write_text(new)
            print(f"  {'would bump' if check else 'bumped'}: {path.name} ({n} ref)")
    print(f"\n{changed} file(s) {'would change' if check else 'changed'} -> {repl}")
    return changed


def main() -> None:
    ap = argparse.ArgumentParser(description="Render shared header/footer partials into all pages.")
    ap.add_argument("--check", action="store_true", help="dry-run: report changes, write nothing")
    ap.add_argument("--limit", type=int, default=None, help="process only the first N pages")
    ap.add_argument("--bump-css", type=int, metavar="N", default=None,
                    help="rewrite pp.css?v=N across all pages, then exit")
    args = ap.parse_args()

    if args.bump_css is not None:
        bump_css(args.bump_css, args.check)
        return
    build(args.check, args.limit)


if __name__ == "__main__":
    main()
