/* Get Real: shared behaviour for supporting pages. No dependencies. Everything here is an enhancement:
   pages are fully usable without it. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  /* Mobile menu */
  var menuBtn = $('.menu-btn'), mnav = $('#mnav');
  function setMenu(open) {
    if (!menuBtn || !mnav) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mnav.classList.toggle('is-open', open);
  }
  if (menuBtn && mnav) {
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (mnav.classList.contains('is-open') && !e.target.closest('.hdr')) setMenu(false);
    });
    $$('a', mnav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  }

  /* Header flips to light glass over light sheets */
  var hdr = $('#hdr'), secs = $$('main > section, .site-ftr'), queued = false;
  function hdrTheme() {
    queued = false;
    var cur = null;
    for (var i = 0; i < secs.length; i++) { if (secs[i].getBoundingClientRect().top <= 42) cur = secs[i]; }
    if (hdr) hdr.classList.toggle('on-light', !!cur && (cur.classList.contains('s-light') || cur.classList.contains('s-white')));
  }
  window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(hdrTheme); } }, { passive: true });
  window.addEventListener('resize', hdrTheme);
  hdrTheme();

  /* Scroll reveals */
  var revealEls = $$('[data-reveal], .hl-wrap, .slots');
  if ('IntersectionObserver' in window) {
    root.classList.add('io-ok');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    root.classList.add('revealed');
  }

  if (reduce) return;

  /* Cursor-following glow in the page hero */
  var hero = $('.phero'), orb = $('.orb-cursor');
  if (fine && hero && orb) {
    var tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    var loop = function () {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      orb.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      raf = (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) ? requestAnimationFrame(loop) : 0;
    };
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(loop);
    });
  }

  /* Magnetic buttons */
  if (fine) {
    $$('.magnetic').forEach(function (b) {
      b.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1), box-shadow .4s, background-position .6s';
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) * 0.2, dy = (e.clientY - r.top - r.height / 2) * 0.28;
        b.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });

    /* Spotlight on cards */
    $$('[data-spot]').forEach(function (t) {
      t.addEventListener('pointermove', function (e) {
        var r = t.getBoundingClientRect();
        t.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        t.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });
  }
})();
