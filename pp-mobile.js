/* Pivot Path — mobile scroll-affordance helper.
   Additive & framework-free. Toggles classes the mobile @media rules in pp.css
   use to hide the "more" cues once a scroller reaches its end. Safe on desktop
   (the styled pseudo-elements only exist inside the mobile media queries). */
(function () {
  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(function () {
    // 1) Horizontal strips: .hscroll (capability pills) + .anchor-nav.
    function wireH(el, scroller) {
      if (!scroller) return;
      var upd = function () {
        var more = scroller.scrollWidth - scroller.clientWidth > 2;
        var atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
        el.classList.toggle('is-end', !more || atEnd);
      };
      scroller.addEventListener('scroll', upd, { passive: true });
      window.addEventListener('resize', upd);
      upd();
    }
    document.querySelectorAll('.hscroll').forEach(function (w) {
      wireH(w, w.querySelector('.cap-tabs') || w.querySelector(':scope > .row'));
    });
    document.querySelectorAll('.anchor-nav').forEach(function (n) {
      wireH(n, n.querySelector('.inner'));
    });

    // 2) Mobile menu: show "⌄ more" only when #nav is scrollable and not at the bottom.
    var nav = document.getElementById('nav');
    var header = document.querySelector('.grey-header');
    if (nav && header) {
      var updMenu = function () {
        var scrollable = nav.scrollHeight - nav.clientHeight > 2;
        var atEnd = nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 2;
        header.classList.toggle('menu-at-end', !scrollable || atEnd);
      };
      nav.addEventListener('scroll', updMenu, { passive: true });
      window.addEventListener('resize', updMenu);
      // recompute after Bootstrap collapse/dropdown transitions change the menu height
      nav.addEventListener('shown.bs.collapse', updMenu);
      nav.addEventListener('shown.bs.dropdown', updMenu);
      nav.addEventListener('hidden.bs.dropdown', updMenu);
      updMenu();
    }

    // 3) Recentre the active/tapped capability pill so it never sits off-screen.
    document.querySelectorAll('.cap-tabs .cap-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        t.scrollIntoView({ inline: 'center', block: 'nearest' });
      });
    });

    // 4) Anchor-nav: centre the active link on load and when a link is tapped.
    document.querySelectorAll('.anchor-nav').forEach(function (n) {
      var active = n.querySelector('a.active');
      if (active) active.scrollIntoView({ inline: 'center', block: 'nearest' });
      n.querySelectorAll('a').forEach(function (l) {
        l.addEventListener('click', function () {
          l.scrollIntoView({ inline: 'center', block: 'nearest' });
        });
      });
    });

    // 5) Mobile-only progressive disclosure. Enhancements are applied while the
    // mobile media query matches and stripped when it stops matching, so
    // desktop DOM semantics stay untouched. CSS lives in the pp.css mobile pass.
    var mq = window.matchMedia('(max-width:768px)');

    function footerGroups() {
      var groups = [];
      document.querySelectorAll('.footer .row [class*="col-"]').forEach(function (col) {
        var current = null;
        Array.prototype.forEach.call(col.children, function (ch) {
          if (ch.tagName === 'H6') { current = { h: ch, links: [] }; groups.push(current); }
          else if (current && ch.tagName === 'A') { current.links.push(ch); }
        });
      });
      return groups.filter(function (g) {
        return g.links.length && g.h.textContent.trim() !== 'Contact';
      });
    }

    function setupFooter(on) {
      footerGroups().forEach(function (g) {
        if (on) {
          g.h.setAttribute('role', 'button');
          g.h.setAttribute('tabindex', '0');
          g.h.setAttribute('aria-expanded', 'false');
          g.links.forEach(function (a) { a.classList.add('fgrp-hidden'); });
          if (!g.h.ppWired) {
            g.h.ppWired = true;
            var toggle = function () {
              var open = g.h.getAttribute('aria-expanded') === 'true';
              g.h.setAttribute('aria-expanded', String(!open));
              g.links.forEach(function (a) { a.classList.toggle('fgrp-hidden', open); });
            };
            g.h.addEventListener('click', toggle);
            g.h.addEventListener('keydown', function (e) {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            });
          }
        } else {
          g.h.removeAttribute('role');
          g.h.removeAttribute('tabindex');
          g.h.removeAttribute('aria-expanded');
          g.links.forEach(function (a) { a.classList.remove('fgrp-hidden'); });
        }
      });
    }

    function applyMobile() {
      setupFooter(mq.matches);
    }
    if (mq.addEventListener) mq.addEventListener('change', applyMobile);
    else mq.addListener(applyMobile);
    applyMobile();
  });
})();
