# Analytics & Ads — Go-Live Setup

Everything is **already wired into the site**. Nothing tracks or fires yet because
the IDs are placeholders. At go-live you paste four IDs into one file and it all
activates — no other code changes.

## The one file you edit

`pp-analytics.js` → top `CONFIG` block:

| Field | What to paste | Where to get it |
|---|---|---|
| `GA4_MEASUREMENT_ID` | `G-XXXXXXXXXX` | GA4 → Admin ▸ Data Streams ▸ Web ▸ your stream |
| `GOOGLE_ADS_ID` | `AW-XXXXXXXXXX` | Google Ads → Goals ▸ Conversions ▸ Google tag |
| `GOOGLE_ADS_CONVERSION_LABEL` | the label string | Google Ads → the conversion action you create |
| `BING_UET_TAG_ID` | numeric tag id | Microsoft Advertising → Tools ▸ UET tag |
| `LINKEDIN_PARTNER_ID` | numeric partner id | LinkedIn Campaign Manager → Analyze ▸ Insight Tag |
| `LINKEDIN_CONVERSION_ID` | numeric conversion id | LinkedIn Campaign Manager → the conversion you create (for lead events) |

A value only goes live once it no longer contains an `X`, so half-filled configs stay inert.

## What activates when you fill them in

- **GA4** → visitors, sessions, **bounce rate/engagement**, pageviews — all automatic (no extra setup). In GA4, "bounce rate" = the inverse of engagement rate; both are in Reports ▸ Engagement and can be added to any report.
- **Google Ads tag** → conversion tracking + remarketing audiences, so Search campaigns can optimise to leads and retarget visitors.
- **Bing UET** → the same for Microsoft/Bing ads.
- **LinkedIn Insight Tag** → conversion tracking + retargeting audiences + basic demographics for LinkedIn campaigns.
- **Lead events** → a `generate_lead` (GA4) + `conversion` (Google Ads) + `submit_lead_form` (Bing) + `lintrk` conversion (LinkedIn, once `LINKEDIN_CONVERSION_ID` is set) fire automatically when a visitor submits the lead form.

## Console steps (do once, at go-live)

**Google Analytics 4**
1. Create a GA4 property → add a **Web** data stream for `pivotpath.com` → copy the `G-…` id into `CONFIG`.

**Google Ads (Search)**
1. Create a Google Ads account.
2. Goals ▸ Conversions ▸ **New conversion action ▸ Website** → e.g. "Lead — CTA click". Copy the `AW-…` id and the **conversion label** into `CONFIG`.
3. **Link Google Ads ↔ GA4** (Admin ▸ Product Links) so GA4 audiences/conversions are usable in Ads.
4. Build the Search campaign in the Ads console (keywords like *"pharmacovigilance outsourcing", "ICSR case processing"*, ad copy, budget). The site already carries the tag, so conversions/remarketing work from day one.

**Microsoft Advertising (Bing)**
1. Create a Microsoft Advertising account → Tools ▸ **UET tag** → copy the tag id into `CONFIG`.
2. Create a **conversion goal** using the `submit_lead_form` UET event (or a destination goal).
3. Build the Bing Search campaign. (You can import the Google Ads campaign directly.)

**LinkedIn Ads**
1. Campaign Manager → Analyze ▸ **Insight Tag** → the partner id is already in `CONFIG` (`9661252`). Confirm the tag reports "active" once the site is live (it loads only after marketing consent).
2. Create a **conversion** (Analyze ▸ Conversion tracking) → copy its numeric conversion id into `LINKEDIN_CONVERSION_ID` so the lead form fires a `lintrk` conversion.
3. The Insight Tag is loaded via `pp-analytics.js` (JS, consent-gated) — the standard `<noscript>` fallback pixel is intentionally omitted because it cannot honour consent.

## Verification & indexing (recommended for ads + SEO)

- **Google Search Console**: add `pivotpath.com`. Easiest verification = "via Google Analytics" (works once GA4 is live), or DNS. Then submit the sitemap.
- **Bing Webmaster Tools**: add the site (can import from Search Console), submit the sitemap.
- **Sitemap**: `sitemap.xml` (21 canonical pages) and `robots.txt` are already in the repo root and reference `https://pivotpath.com/sitemap.xml`. Submit the sitemap in both consoles.

## Privacy / consent (important for a regulated, EU-facing audience)

GA4 and ad tags set cookies. For EU/UK visitors you should gate them behind consent
(**Google Consent Mode v2**) via a consent banner/CMP before switching tags on in those
regions. This is not yet implemented — flag if you want a lightweight consent banner added.

## Notes

- Base domain used throughout is `https://pivotpath.com`. If the live domain differs, update it in `pp-analytics.js` gtag config is automatic, but update `sitemap.xml`/`robots.txt`.
- FAQ/Organization/Product **JSON-LD** is already on every page (helps the same Search Console/ads landing-page quality signals).
- The tag is loaded site-wide via `<script src="pp-analytics.js">` in each page's `<head>`.
