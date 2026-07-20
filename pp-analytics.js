/* =============================================================================
   Pivot Path — Analytics & Ads tags (GA4 + Google Ads + Microsoft/Bing UET)
   -----------------------------------------------------------------------------
   CONSENT-GATED. Nothing fires on load. This file registers with the consent
   manager (window.ppConsent, from pp-consent.js) and boots each tag only for a
   category the visitor has granted:
       analytics → GA4
       marketing → Google Ads + Bing UET
   If pp-consent.js is absent, NOTHING loads (fail-safe = no tracking).

   GO-LIVE: paste your real IDs into CONFIG below. Until you do, a tag stays inert
   even after consent — every tag is also gated on a real (non-placeholder) ID.
   See ANALYTICS-SETUP.md.
   ============================================================================= */
(function () {
  "use strict";

  var CONFIG = {
    GA4_MEASUREMENT_ID:          "G-9KWG1J0669",   // GA4 → Admin ▸ Data Streams ▸ Web
    GOOGLE_ADS_ID:               "AW-6780614429",  // Google Ads acct 678-061-4429 ▸ Goals ▸ Conversions ▸ Google tag
    GOOGLE_ADS_CONVERSION_LABEL: "XxXxXxXxXxXxXxXxXx", // the conversion action's label
    BING_UET_TAG_ID:             "XXXXXXXX"         // Microsoft Advertising ▸ UET tag
  };

  // A value is "real" only if it still isn't the placeholder (placeholders use 'X').
  function isSet(v) { return typeof v === "string" && v.length > 0 && v.indexOf("X") === -1; }

  var gaOn  = isSet(CONFIG.GA4_MEASUREMENT_ID);   // analytics category
  var adsOn = isSet(CONFIG.GOOGLE_ADS_ID);        // marketing category
  var uetOn = isSet(CONFIG.BING_UET_TAG_ID);      // marketing category

  var analyticsBooted = false, marketingBooted = false;

  // ---- GA4 (analytics) -------------------------------------------------------
  function initAnalytics() {
    if (analyticsBooted || !gaOn) return;
    analyticsBooted = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.GA4_MEASUREMENT_ID);
    document.head.appendChild(s);
    gtag("config", CONFIG.GA4_MEASUREMENT_ID);
  }

  // ---- Google Ads + Bing UET (marketing) ------------------------------------
  function initMarketing() {
    if (marketingBooted) return;
    marketingBooted = true;
    if (adsOn) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      gtag("js", new Date());
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.GOOGLE_ADS_ID);
      document.head.appendChild(s);
      gtag("config", CONFIG.GOOGLE_ADS_ID);
    }
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
  }

  window.ppAnalytics = { initAnalytics: initAnalytics, initMarketing: initMarketing };

  // ---- Lead conversion events on primary CTAs (respect consent) --------------
  // Called by pp-crm.js when the capture form is actually submitted. Fires only
  // to platforms whose category is granted. No-op until IDs are set / consented.
  window.ppTrackLead = function (label, page) {
    try {
      var okA = window.ppConsent ? ppConsent.get("analytics") : false;
      var okM = window.ppConsent ? ppConsent.get("marketing") : false;
      if (window.gtag && gaOn && okA) {
        gtag("event", "generate_lead", { cta: label, page_path: page || location.pathname });
      }
      if (window.gtag && adsOn && okM && isSet(CONFIG.GOOGLE_ADS_CONVERSION_LABEL)) {
        gtag("event", "conversion", {
          send_to: CONFIG.GOOGLE_ADS_ID + "/" + CONFIG.GOOGLE_ADS_CONVERSION_LABEL
        });
      }
      if (window.uetq && uetOn && okM) {
        window.uetq.push("event", "submit_lead_form", { event_category: "cta", event_label: label });
      }
    } catch (e) { /* no-op */ }
  };

  // A CTA click is an intent signal only (the lead/conversion fires on form submit).
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var href = (a.getAttribute("href") || "").toLowerCase();
    var txt  = (a.textContent || "").trim().toLowerCase();
    var isLead = href.indexOf("mailto:") === 0 ||
                 /talk to our experts|book a[n]? .*demo|book a demo|submit rfp|contact us/.test(txt);
    if (!isLead) return;
    var okA = window.ppConsent ? ppConsent.get("analytics") : false;
    if (window.gtag && gaOn && okA) {
      gtag("event", "cta_click", { cta: (a.textContent || "").trim().slice(0, 80), page_path: location.pathname });
    }
  }, true);

  // ---- Boot: honour any decision already stored, and react to changes --------
  function boot() {
    if (!window.ppConsent) return;                 // fail-safe: no consent manager → no tracking
    if (ppConsent.get("analytics")) initAnalytics();
    if (ppConsent.get("marketing")) initMarketing();
    ppConsent.onChange(function (st) {
      if (st.analytics) initAnalytics();
      if (st.marketing) initMarketing();
    });
  }
  boot();
})();
