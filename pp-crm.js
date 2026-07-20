/* =============================================================================
   Pivot Path — CTA → Freshsales (Freshworks CRM) lead capture
   -----------------------------------------------------------------------------
   A bare CTA click carries no email, and fwcrm.identify() needs one — so clicking
   a lead CTA opens a small capture form. On submit we:
     • fwcrm.identify(email, {First name, Last name, Email, company})  → create contact
     • fwcrm.set({page + which CTA they clicked, phone})               → attach context
     • window.ppTrackLead(cta, page)                                   → fire GA4/Ads/Bing
   `fwcrm` is provided by the Freshworks widget already loaded in <head>. If it isn't
   present (e.g. before go-live) the form still validates and closes gracefully.

   NOTE: the two context fields ("Last CTA clicked", "CTA source page") and "CTA page
   title" must exist as custom Contact fields in Freshsales for fwcrm.set to store them.
   ============================================================================= */
(function () {
  "use strict";

  var ctx = { cta: "", page: location.pathname + location.search, title: document.title };
  var modal = null;

  function isEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }

  // Path-aware privacy link (works from root pages and sub-dir pages like /eu/).
  function privacyHref() {
    var s = document.querySelector('script[src$="pp-crm.js"]');
    var src = s ? s.getAttribute("src") : "pp-crm.js";
    return src.replace(/pp-crm\.js.*$/, "") + "pivotpath-privacy-policy.html";
  }

  // A lead CTA = "Talk to our ...", "Book a[n] ... demo", "Submit RFP", or any mailto.
  function isLeadCta(a) {
    var txt = (a.textContent || "").trim().toLowerCase();
    var href = (a.getAttribute("href") || "").toLowerCase();
    if (href.indexOf("mailto:") === 0) return true;
    return /talk to our|book a[n]? .*demo|submit rfp|^discuss\b/.test(txt);
  }

  function build() {
    var w = document.createElement("div");
    w.className = "pp-lead-modal";
    w.setAttribute("aria-hidden", "true");
    w.innerHTML =
      '<div class="pp-lead-backdrop" data-close></div>' +
      '<div class="pp-lead-card" role="dialog" aria-modal="true" aria-labelledby="pp-lead-title">' +
        '<button class="pp-lead-x" data-close aria-label="Close">&times;</button>' +
        '<h3 id="pp-lead-title">Talk to our experts</h3>' +
        '<p class="pp-lead-sub">Share your details and our team will be in touch.</p>' +
        '<form id="pp-lead-form" novalidate>' +
          '<div class="pp-lead-row">' +
            '<input name="first" placeholder="First name" autocomplete="given-name" required>' +
            '<input name="last" placeholder="Last name" autocomplete="family-name" required>' +
          '</div>' +
          '<input name="email" type="email" placeholder="Work email" autocomplete="email" required>' +
          '<input name="company" placeholder="Company (optional)" autocomplete="organization">' +
          '<input name="phone" placeholder="Phone (optional)" autocomplete="tel">' +
          '<div class="pp-lead-err" role="alert"></div>' +
          '<button type="submit" class="pp-lead-submit">Submit</button>' +
          '<p class="pp-lead-privacy">By submitting, you agree we may contact you about your enquiry. See our <a href="' + privacyHref() + '">Privacy Policy</a>.</p>' +
          '<p class="pp-lead-ctx"></p>' +
        '</form>' +
        '<div class="pp-lead-done" hidden><h3>Thank you</h3>' +
          '<p>We’ve got your details — our team will reach out shortly.</p>' +
          '<button class="pp-lead-submit" data-close>Close</button></div>' +
      '</div>';
    document.body.appendChild(w);
    w.addEventListener("click", function (e) { if (e.target.hasAttribute("data-close")) closeModal(); });
    w.querySelector("#pp-lead-form").addEventListener("submit", onSubmit);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    return w;
  }

  function openModal(label) {
    if (!modal) modal = build();
    ctx = { cta: label, page: location.pathname + location.search, title: document.title };
    fmEvent("CTA Clicked", { "cta": ctx.cta, "page": ctx.page, "page title": ctx.title });
    var title = /book a[n]? .*demo/i.test(label) ? "Book a demo"
              : /submit rfp/i.test(label) ? "Submit an RFP" : "Talk to our experts";
    modal.querySelector("#pp-lead-title").textContent = title;
    modal.querySelector(".pp-lead-ctx").textContent = "Enquiry: " + label;
    modal.querySelector("#pp-lead-title").hidden = false;
    modal.querySelector(".pp-lead-sub").hidden = false;
    modal.querySelector("#pp-lead-form").hidden = false;
    modal.querySelector(".pp-lead-done").hidden = true;
    modal.querySelector(".pp-lead-err").textContent = "";
    modal.querySelector("#pp-lead-form").reset();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    var f = modal.querySelector("input[name=first]"); if (f) f.focus();
  }
  function closeModal() {
    if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
  }

  function pushToCrm(email, contact, props) {
    try {
      if (typeof fwcrm !== "undefined" && fwcrm.identify) {
        fwcrm.identify(email, contact);
        if (fwcrm.set && props) fwcrm.set(props);
      }
    } catch (e) { /* no-op */ }
  }

  // Freshmarketer behavioural custom event (timeline / journeys / segmentation).
  // Marketing-category tracking — only fires with marketing consent, and only if
  // FM is present (the Freshworks widget loads under functional consent).
  function fmEvent(name, props) {
    try {
      if (window.ppConsent && !ppConsent.get("marketing")) return;
      if (typeof FM !== "undefined" && FM.trackCustomEvent) FM.trackCustomEvent(name, props || {});
    } catch (e) { /* no-op */ }
  }

  function onSubmit(e) {
    e.preventDefault();
    var f = e.target;
    var first = f.first.value.trim(), last = f.last.value.trim(), email = f.email.value.trim(),
        company = f.company.value.trim(), phone = f.phone.value.trim();
    var err = modal.querySelector(".pp-lead-err");
    if (!first || !last || !isEmail(email)) {
      err.textContent = "Please enter your name and a valid work email.";
      return;
    }
    var contact = { "First name": first, "Last name": last, "Email": email };
    if (company) contact.company = { "Name": company };
    var props = { "Last CTA clicked": ctx.cta, "CTA source page": ctx.page, "CTA page title": ctx.title };
    if (phone) props["Mobile"] = phone;

    pushToCrm(email, contact, props);
    fmEvent("Lead Captured", { "email": email, "cta": ctx.cta, "page": ctx.page,
                               "page title": ctx.title, "company": company });
    if (window.ppTrackLead) window.ppTrackLead(ctx.cta, ctx.page);   // GA4 / Ads / Bing conversion

    f.hidden = true;
    // Confirmation view shows only the done state: hide the form title + subtitle
    // (they are siblings of the form, not children, so they'd otherwise remain visible).
    modal.querySelector("#pp-lead-title").hidden = true;
    modal.querySelector(".pp-lead-sub").hidden = true;
    modal.querySelector(".pp-lead-done").hidden = false;
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (a && isLeadCta(a)) { e.preventDefault(); openModal((a.textContent || "CTA").trim()); return; }

    // Newsletter subscribe = email-only identify.
    var btn = e.target && e.target.closest ? e.target.closest(".newsletter button, .newsletter .btns2") : null;
    if (btn) {
      e.preventDefault();
      var grp = btn.closest(".newsletter");
      var inp = grp && grp.querySelector('input[type="email"]');
      var email = inp && inp.value.trim();
      if (email && isEmail(email)) {
        pushToCrm(email, { "Email": email },
                  { "Last CTA clicked": "Newsletter subscribe", "CTA source page": location.pathname });
        fmEvent("Newsletter Subscribed", { "email": email, "page": location.pathname });
        if (window.ppTrackLead) window.ppTrackLead("Newsletter subscribe", location.pathname);
        inp.value = ""; inp.placeholder = "Subscribed ✓";
      } else if (inp) { inp.focus(); }
    }
  });
})();
