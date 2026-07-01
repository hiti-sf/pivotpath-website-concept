/* =============================================================================
   Pivot Path — Analytics & Ads tags (GA4 + Google Ads + Microsoft/Bing UET)
   -----------------------------------------------------------------------------
   GO-LIVE: paste your real IDs into CONFIG below. Until you do, NOTHING loads
   or fires — every tag is gated on a real (non-placeholder) ID, so this file is
   completely inert in the preview. See ANALYTICS-SETUP.md for where each ID comes
   from and the console steps.

   What you get once IDs are filled in:
     • GA4          → visitors, sessions, bounce/engagement, pageviews (automatic)
     • Google Ads   → conversion tracking + remarketing tag (for Search ads)
     • Bing UET     → conversion tracking + remarketing (for Microsoft/Bing ads)
     • Lead events  → fired to all three when a visitor clicks a primary CTA
                      (Talk to our experts / Book a demo / Submit RFP / any mailto)
   ============================================================================= */
(function () {
  "use strict";

  var CONFIG = {
    GA4_MEASUREMENT_ID:          "G-XXXXXXXXXX",   // GA4 → Admin ▸ Data Streams ▸ Web
    GOOGLE_ADS_ID:               "AW-XXXXXXXXXX",  // Google Ads ▸ Goals ▸ Conversions ▸ tag
    GOOGLE_ADS_CONVERSION_LABEL: "XxXxXxXxXxXxXxXxXx", // the conversion action's label
    BING_UET_TAG_ID:             "XXXXXXXX"         // Microsoft Advertising ▸ UET tag
  };

  // A value is "real" only if it still isn't the placeholder (placeholders use 'X').
  function isSet(v) { return typeof v === "string" && v.length > 0 && v.indexOf("X") === -1; }

  var gaOn  = isSet(CONFIG.GA4_MEASUREMENT_ID);
  var adsOn = isSet(CONFIG.GOOGLE_ADS_ID);
  var uetOn = isSet(CONFIG.BING_UET_TAG_ID);

  // ---- Google gtag.js (GA4 + Google Ads share one gtag instance) -------------
  if (gaOn || adsOn) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    var primary = gaOn ? CONFIG.GA4_MEASUREMENT_ID : CONFIG.GOOGLE_ADS_ID;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(primary);
    document.head.appendChild(s);
    if (gaOn)  gtag("config", CONFIG.GA4_MEASUREMENT_ID);   // visitors/sessions/bounce
    if (adsOn) gtag("config", CONFIG.GOOGLE_ADS_ID);        // Google Ads remarketing
  }

  // ---- Microsoft Advertising (Bing) UET --------------------------------------
  if (uetOn) {
    (function (w, d, t, r, u) {
      var f, n, i;
      w[u] = w[u] || [];
      f = function () {
        var o = { ti: CONFIG.BING_UET_TAG_ID, enableAutoSpaTracking: true };
        o.q = w[u]; w[u] = new UET(o); w[u].push("pageLoad");
      };
      n = d.createElement(t); n.src = r; n.async = 1;
      n.onload = n.onreadystatechange = function () {
        var st = this.readyState;
        if (!st || st === "loaded" || st === "complete") { f(); n.onload = n.onreadystatechange = null; }
      };
      i = d.getElementsByTagName(t)[0]; i.parentNode.insertBefore(n, i);
    })(window, document, "script", "//bat.bing.com/bat.js", "uetq");
  }

  // ---- Lead conversion events on primary CTAs --------------------------------
  // Fires a lead event to whichever platforms are live when a visitor clicks a
  // contact/demo/RFP CTA or any mailto: link. Harmless (no-op) until IDs are set.
  function isLeadClick(a) {
    var href = (a.getAttribute("href") || "").toLowerCase();
    var txt  = (a.textContent || "").trim().toLowerCase();
    if (href.indexOf("mailto:") === 0) return true;
    return /talk to our experts|book a[n]? .*demo|book a demo|submit rfp|contact us/.test(txt);
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a || !isLeadClick(a)) return;
    var label = (a.textContent || "").trim().slice(0, 80);

    if (window.gtag && gaOn) {
      gtag("event", "generate_lead", { cta: label, page_path: location.pathname });
    }
    if (window.gtag && adsOn && isSet(CONFIG.GOOGLE_ADS_CONVERSION_LABEL)) {
      gtag("event", "conversion", {
        send_to: CONFIG.GOOGLE_ADS_ID + "/" + CONFIG.GOOGLE_ADS_CONVERSION_LABEL
      });
    }
    if (window.uetq && uetOn) {
      window.uetq.push("event", "submit_lead_form", { event_category: "cta", event_label: label });
    }
  }, true);
})();
