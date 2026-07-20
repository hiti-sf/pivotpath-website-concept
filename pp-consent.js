/* =============================================================================
   Pivot Path — Consent Management (GDPR opt-in + CCPA / GPC)
   -----------------------------------------------------------------------------
   Single owner of every NON-ESSENTIAL tracker. Nothing tracking-related loads
   until the visitor grants the matching category, so "block prior tracking" is
   structural (there is no auto-firing tag to race), not a timing hack.

   Categories:
     necessary  — always on, locked (this file, Bootstrap, the pp-crm modal)
     functional — Freshworks live chat  (//in.fw-cdn.com/...)
     analytics  — Microsoft Clarity  (+ GA4, self-loaded by pp-analytics.js)
     marketing  — Google Ads + Bing UET (self-loaded by pp-analytics.js),
                  Freshmarketer behavioural events (gated in pp-crm.js)

   GA4 / Ads / Bing IDs live in pp-analytics.js; it reads window.ppConsent and
   boots each tag only for a granted category. This file injects Clarity and the
   Freshworks widget directly (they have no dedicated file).

   Public API (window.ppConsent):
     .open()        open the preferences modal (footer "Cookie preferences" link)
     .get(cat)      boolean — is this category currently granted?
     .state()       the full stored decision object (or null if undecided)
     .acceptAll()   grant every category
     .rejectAll()   deny every non-essential category
     .onChange(fn)  fn(state) called whenever consent is applied/changed
   ============================================================================= */
(function () {
  "use strict";

  var POLICY_VERSION = 1;                 // bump to force re-consent after policy changes
  var STORE_KEY = "pp_consent";
  var MAX_AGE = 60 * 60 * 24 * 365;       // 12 months, seconds
  var CATS = ["functional", "analytics", "marketing"];   // non-essential
  var loaded = {};                        // idempotency guard for direct loaders
  var listeners = [];
  var bannerEl = null, modalEl = null;

  var gpc = (typeof navigator !== "undefined" && navigator.globalPrivacyControl === true);

  // ---- storage --------------------------------------------------------------
  function cookieGet(n) {
    var m = document.cookie.match("(?:^|; )" + n + "=([^;]*)");
    return m ? decodeURIComponent(m[1]) : null;
  }
  function cookieSet(n, v) {
    document.cookie = n + "=" + encodeURIComponent(v) + ";max-age=" + MAX_AGE + ";path=/;SameSite=Lax";
  }
  function cookieDel(n) {
    var host = location.hostname, root = host.replace(/^www\./, "");
    document.cookie = n + "=;max-age=0;path=/";
    document.cookie = n + "=;max-age=0;path=/;domain=" + host;
    document.cookie = n + "=;max-age=0;path=/;domain=." + root;
  }
  function readState() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
    if (!raw) raw = cookieGet(STORE_KEY);
    if (!raw) return null;
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object" || o.v !== POLICY_VERSION) return null;   // undecided / stale
      return o;
    } catch (e) { return null; }
  }
  function writeState(o) {
    o.v = POLICY_VERSION; o.ts = Date.now(); o.necessary = true;
    var s = JSON.stringify(o);
    try { localStorage.setItem(STORE_KEY, s); } catch (e) { /* ignore */ }
    cookieSet(STORE_KEY, s);
  }

  // ---- known third-party cookies (best-effort cleanup on withdrawal) --------
  function clearTrackingCookies() {
    var kill = /^(_ga|_gid|_gat|_gcl|_clck|_clsk|CLID|MUID|MUIDB|_uet|SM|_fbp|fw_|__cf)/i;
    document.cookie.split(";").forEach(function (c) {
      var n = c.split("=")[0].trim();
      if (n && kill.test(n)) cookieDel(n);
    });
  }

  // ---- loaders (only run when their category is granted) --------------------
  function loadFunctional() {
    if (loaded.functional) return; loaded.functional = true;
    var s = document.createElement("script");
    s.src = "//in.fw-cdn.com/32228802/1191962.js";
    s.setAttribute("chat", "true");
    s.async = true;
    document.head.appendChild(s);
  }
  function loadAnalytics() {
    if (loaded.analytics) return; loaded.analytics = true;
    // Microsoft Clarity (moved here from the page <head> so it is consent-gated)
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", "xp6ircnd01");
    // GA4 is booted by pp-analytics.js via ppConsent.get('analytics') + onChange.
  }
  // Ads + Bing (marketing) are booted by pp-analytics.js; no direct loader needed here.

  function applyGrants(st) {
    if (st.functional) loadFunctional();
    if (st.analytics) loadAnalytics();
    // marketing tags self-boot in pp-analytics via onChange/boot
    fireChange(st);
  }
  function fireChange(st) {
    listeners.forEach(function (fn) { try { fn(st); } catch (e) { /* ignore */ } });
  }

  // ---- decision helpers -----------------------------------------------------
  function decide(vals) {
    var prev = readState() || {};
    var next = {
      functional: !!vals.functional,
      analytics: !!vals.analytics,
      marketing: !!vals.marketing
    };
    writeState(next);
    hideBanner();
    closeModal();
    var downgraded = CATS.some(function (c) { return prev[c] && !next[c]; });
    if (downgraded) {
      // A previously-active tracker was switched off — clear its cookies and
      // reload so nothing keeps running in this page's memory.
      clearTrackingCookies();
      location.reload();
      return;
    }
    applyGrants(next);
  }

  // ---- UI: banner -----------------------------------------------------------
  function scriptBase() {
    var s = document.querySelector('script[src$="pp-consent.js"]');
    var src = s ? s.getAttribute("src") : "pp-consent.js";
    return src.replace(/pp-consent\.js.*$/, "");
  }
  function privacyHref() { return scriptBase() + "pivotpath-privacy-policy.html"; }

  function buildBanner() {
    var b = document.createElement("div");
    b.className = "pp-cc-banner";
    b.setAttribute("role", "dialog");
    b.setAttribute("aria-label", "Cookie consent");
    b.innerHTML =
      '<div class="pp-cc-inner">' +
        '<div class="pp-cc-copy">' +
          '<strong>We value your privacy</strong>' +
          '<p>We use cookies to run this site, understand how it is used, and support our services. ' +
          'You can accept all, reject all, or choose by category. Read our ' +
          '<a href="' + privacyHref() + '">Privacy Policy</a>.</p>' +
        '</div>' +
        '<div class="pp-cc-actions">' +
          '<button type="button" class="pp-cc-btn pp-cc-ghost" data-cc="manage">Manage preferences</button>' +
          '<button type="button" class="pp-cc-btn pp-cc-dark" data-cc="reject">Reject all</button>' +
          '<button type="button" class="pp-cc-btn pp-cc-solid" data-cc="accept">Accept all</button>' +
        '</div>' +
      '</div>';
    b.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-cc]") : null;
      if (!t) return;
      var a = t.getAttribute("data-cc");
      if (a === "accept") api.acceptAll();
      else if (a === "reject") api.rejectAll();
      else if (a === "manage") openModal();
    });
    document.body.appendChild(b);
    return b;
  }
  function showBanner() { if (!bannerEl) bannerEl = buildBanner(); bannerEl.classList.add("open"); }
  function hideBanner() { if (bannerEl) bannerEl.classList.remove("open"); }

  // ---- UI: preferences modal ------------------------------------------------
  var ROWS = [
    { key: "necessary", locked: true, title: "Strictly necessary",
      desc: "Required for the site to work (security, page rendering, saving your cookie choices). Always on." },
    { key: "functional", locked: false, title: "Functional",
      desc: "Enables the live-chat widget so you can talk to our team. Off unless you allow it." },
    { key: "analytics", locked: false, title: "Analytics",
      desc: "Helps us understand how the site is used so we can improve it (Microsoft Clarity, Google Analytics)." },
    { key: "marketing", locked: false, title: "Marketing",
      desc: "Used to measure and personalise our advertising, and may involve sharing data with advertising partners (Google Ads, Microsoft Advertising). Turning this off is your “Do Not Sell or Share My Personal Information” choice." }
  ];
  function buildModal() {
    var m = document.createElement("div");
    m.className = "pp-cc-modal";
    m.setAttribute("aria-hidden", "true");
    var rows = ROWS.map(function (r) {
      var checked = r.locked ? "checked disabled" : "";
      return '<div class="pp-cc-row">' +
        '<label class="pp-cc-toggle">' +
          '<input type="checkbox" data-cat="' + r.key + '" ' + checked + '>' +
          '<span class="pp-cc-track" aria-hidden="true"></span>' +
        '</label>' +
        '<div class="pp-cc-rowtext"><strong>' + r.title + '</strong><p>' + r.desc + '</p></div>' +
      '</div>';
    }).join("");
    m.innerHTML =
      '<div class="pp-cc-backdrop" data-cc-close></div>' +
      '<div class="pp-cc-card" role="dialog" aria-modal="true" aria-labelledby="pp-cc-h">' +
        '<button type="button" class="pp-cc-x" data-cc-close aria-label="Close">&times;</button>' +
        '<h2 id="pp-cc-h">Cookie preferences</h2>' +
        '<p class="pp-cc-lead">Choose which cookies we may use. You can change this at any time from the ' +
        '“Cookie preferences” link in the footer. See our <a href="' + privacyHref() + '">Privacy Policy</a>.</p>' +
        '<div class="pp-cc-rows">' + rows + '</div>' +
        '<div class="pp-cc-modal-actions">' +
          '<button type="button" class="pp-cc-btn pp-cc-dark" data-cc="reject">Reject all</button>' +
          '<button type="button" class="pp-cc-btn pp-cc-line" data-cc="save">Save preferences</button>' +
          '<button type="button" class="pp-cc-btn pp-cc-solid" data-cc="accept">Accept all</button>' +
        '</div>' +
      '</div>';
    m.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-cc-close")) { closeModal(); return; }
      var t = e.target.closest ? e.target.closest("[data-cc]") : null;
      if (!t) return;
      var a = t.getAttribute("data-cc");
      if (a === "accept") api.acceptAll();
      else if (a === "reject") api.rejectAll();
      else if (a === "save") saveFromModal();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    document.body.appendChild(m);
    return m;
  }
  function syncModal() {
    var st = readState() || { functional: false, analytics: false, marketing: gpc ? false : false };
    modalEl.querySelectorAll("input[data-cat]").forEach(function (inp) {
      var c = inp.getAttribute("data-cat");
      if (c === "necessary") { inp.checked = true; return; }
      inp.checked = !!st[c];
    });
  }
  function openModal() {
    if (!modalEl) modalEl = buildModal();
    syncModal();
    modalEl.classList.add("open");
    modalEl.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    if (modalEl) { modalEl.classList.remove("open"); modalEl.setAttribute("aria-hidden", "true"); }
  }
  function saveFromModal() {
    var vals = {};
    modalEl.querySelectorAll("input[data-cat]").forEach(function (inp) {
      var c = inp.getAttribute("data-cat");
      if (c !== "necessary") vals[c] = inp.checked;
    });
    decide(vals);
  }

  // ---- public API -----------------------------------------------------------
  var api = {
    open: function () { openModal(); },
    get: function (cat) { if (cat === "necessary") return true; var st = readState(); return !!(st && st[cat]); },
    state: function () { return readState(); },
    acceptAll: function () { decide({ functional: true, analytics: true, marketing: true }); },
    rejectAll: function () { decide({ functional: false, analytics: false, marketing: false }); },
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
  };
  window.ppConsent = api;

  // ---- boot -----------------------------------------------------------------
  var decided = readState();
  if (decided) applyGrants(decided);        // returning visitor: re-arm consented tags now

  function initUI() {
    if (!readState()) showBanner();          // first visit / undecided: prompt
    // (modal is built lazily on first open)
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }
})();
