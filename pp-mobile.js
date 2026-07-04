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
      wireH(w, w.querySelector('.cap-tabs'));
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
  });
})();
