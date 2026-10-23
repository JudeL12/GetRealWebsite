/* Get Real: advanced effects layer.
 *
 * Loaded after the core script in index.html. Everything here is an enhancement:
 * the page is complete without it, and each piece checks what it needs first.
 *
 *   No GSAP needed (run straight away):
 *     1. Sheets       sections widen from a card to full width; the one below sinks back
 *     2. Cursor       a ring that trails the pointer and wraps buttons (mouse only)
 *     3. Tiles        glowing border + light sweep that track the pointer, art parallax
 *     4. Phone glare  a glass reflection that follows the hero tilt
 *     5. Card         holographic foil + glow on the partner card
 *     6. Waitlist     a light tracing the form border; smooth resize on success
 *     7. Eyebrows     small labels "decode" into place
 *   After GSAP starts (the core script fires 'gr:motion'):
 *     8. Odometer     stat digits roll into place
 *     9. Card depth   pointer tilt + parallax layers; rail head on the roadmap
 *    10. Velocity     big headings lean slightly with scroll speed (mouse/trackpad only)
 *
 * Reduced motion: nothing that moves is set up (html.rm). Touch devices get lighter versions.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = root.classList.contains('rm');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  function mk(cls, tag) { var e = document.createElement(tag || 'div'); e.className = cls; e.setAttribute('aria-hidden', 'true'); return e; }
  function safe(fn) { try { fn(); } catch (e) { if (window.console) console.warn('fx skipped:', e); } }

  /* ------------------------------------------------------------------
     1. Sheets. One scroll handler, transforms/opacity only.
     As section S rises, its background widens (scaleX), while the section
     before it (P) scales down a touch and dims. Light sections also get an
     "under" layer so the strip beside a narrow sheet shows P's colour.
     ------------------------------------------------------------------ */
  function sheets() {
    if (reduce) return;
    var secs = $$('main > section');
    var ftr = $('.site-ftr');
    if (ftr) secs.push(ftr);
    var deep = fine && window.innerWidth > 900;   // desktop: full effect; touch: widen + dim only
    var START = deep ? 0.9 : 0.95, SINK = deep ? 0.045 : 0;
    var colorOf = function (el) { return el.classList.contains('s-white') ? '#FFFFFF' : el.classList.contains('s-light') ? '#F5F5F7' : null; };
    var items = [];
    for (var i = 1; i < secs.length; i++) {
      var S = secs[i], P = secs[i - 1];
      var it = { S: S, P: P, p: -1, top: 0, moving: false };
      it.bg = mk('fx-bg'); S.insertBefore(it.bg, S.firstChild);
      var under = colorOf(P);
      if (under) { it.under = mk('fx-under'); it.under.style.background = under; S.insertBefore(it.under, S.firstChild); }
      it.dim = mk('fx-dim'); P.appendChild(it.dim);
      it.light = !!under;
      if (SINK) P.style.transformOrigin = '50% 100%';
      items.push(it);
    }
    root.classList.add('fx-sheets');

    function measure() {
      // Layout position (ignores our own transforms)
      items.forEach(function (it) { var t = 0, e = it.S; while (e) { t += e.offsetTop; e = e.offsetParent; } it.top = t; it.p = -1; });
    }
    function ease(p) { return 1 - (1 - p) * (1 - p); }
    function update() {
      var y = window.scrollY, vh = window.innerHeight;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var p = clamp((vh - (it.top - y)) / (vh * 0.85), 0, 1);
        if (p === it.p) continue;
        it.p = p;
        var e = ease(p), moving = p > 0 && p < 1;
        if (moving !== it.moving) { it.moving = moving; it.bg.classList.toggle('fx-moving', moving); if (SINK) it.P.classList.toggle('fx-moving', moving); }
        it.bg.style.transform = p >= 1 ? '' : 'scaleX(' + (START + (1 - START) * e).toFixed(4) + ')';
        var k = 1 - SINK * p;
        if (SINK) it.P.style.transform = p <= 0 ? '' : 'scale(' + k.toFixed(4) + ')';
        it.dim.style.opacity = (p * p * (it.light ? 0.14 : deep ? 0.4 : 0.3)).toFixed(3); // eases in late: no dimming while you're still reading
        if (it.under) { it.under.style.transform = SINK && p > 0 ? 'scaleX(' + k.toFixed(4) + ')' : ''; it.under.style.opacity = (1 - p * p * 0.14).toFixed(3); }
      }
    }
    var q = false;
    function onScroll() { if (!q) { q = true; requestAnimationFrame(function () { q = false; update(); }); } }
    measure(); update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { measure(); update(); });
    window.addEventListener('load', function () { measure(); update(); });
    if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); onScroll(); }).observe(document.body);
    // ScrollTrigger measures element positions on refresh: give it untransformed sections.
    if (window.ScrollTrigger) {
      ScrollTrigger.addEventListener('refreshInit', function () { items.forEach(function (it) { it.P.style.transform = ''; }); });
      ScrollTrigger.addEventListener('refresh', function () { measure(); update(); });
    }
  }

  /* ------------------------------------------------------------------
     2. Cursor ring (mouse/trackpad only). The system cursor stays visible.
     Grows over links, wraps around buttons, shows an arrow on external links.
     ------------------------------------------------------------------ */
  function cursor() {
    if (!fine || reduce) return;
    var c = mk('fx-cursor');
    c.innerHTML = '<div class="fx-ring"></div><svg class="fx-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>';
    document.body.appendChild(c);
    var ring = c.firstChild;
    var x = -100, y = -100, px = -100, py = -100, snap = null, raf = 0, mode = '';
    function setMode(m) { if (m === mode) return; ['link', 'ext', 'snap', 'text'].forEach(function (k) { c.classList.toggle(k, k === m); }); mode = m; }
    function unsnap() { snap = null; ring.style.width = ring.style.height = ring.style.margin = ''; }
    function frame() {
      raf = 0;
      var tx = px, ty = py, k = 0.2;
      if (snap) {
        var r = snap.getBoundingClientRect();
        // Let go if the button scrolled away from under the pointer
        if (px < r.left - 24 || px > r.right + 24 || py < r.top - 24 || py > r.bottom + 24) { unsnap(); setMode(''); }
        else { tx = r.left + r.width / 2 + (px - r.left - r.width / 2) * 0.12; ty = r.top + r.height / 2 + (py - r.top - r.height / 2) * 0.12; k = 0.3; }
      }
      x += (tx - x) * k; y += (ty - y) * k;
      c.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      if (snap || Math.abs(tx - x) > 0.2 || Math.abs(ty - y) > 0.2) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX; py = e.clientY;
      if (x < -50) { x = px; y = py; }
      c.classList.add('on'); kick();
    }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      c.classList.toggle('lt', !!e.target.closest('.s-light, .s-white, .screen'));   // dark ring on light surfaces
      var t = e.target.closest('a, button, summary, label, input, textarea, select');
      if (!t) { unsnap(); setMode(''); return; }
      if (t.matches('input:not([type=radio]), textarea, select')) { unsnap(); setMode('text'); return; }
      if (t.matches('.btn, .money-link, .ftr-mail, .menu-btn')) {
        if (snap !== t) {
          snap = t;
          var r = t.getBoundingClientRect(), w = r.width + 14, h = r.height + 14;
          ring.style.width = w + 'px'; ring.style.height = h + 'px'; ring.style.margin = (-h / 2) + 'px 0 0 ' + (-w / 2) + 'px';
        }
        setMode('snap'); kick(); return;
      }
      unsnap();
      setMode(t.target === '_blank' ? 'ext' : 'link');
    });
    document.addEventListener('pointerdown', function () { c.classList.add('down'); });
    document.addEventListener('pointerup', function () { c.classList.remove('down'); });
    document.documentElement.addEventListener('mouseleave', function () { c.classList.remove('on'); });
    window.addEventListener('blur', function () { c.classList.remove('on'); });
  }

  /* ------------------------------------------------------------------
     3. Bento tiles: the core script already tracks --mx/--my and tilts the tile.
     Here: a border that glows where the pointer is, a light sweep, and the
     illustration container drifting against the tilt for depth.
     ------------------------------------------------------------------ */
  function tiles() {
    if (!fine) return;
    root.classList.add('fx-tiles');
    if (reduce) return;
    $$('[data-tile]').forEach(function (t) {
      var art = $('.tile-art', t);
      if (!art) return;
      t.addEventListener('pointermove', function (e) {
        var r = t.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        art.style.transform = 'translate3d(' + (-nx * 14).toFixed(1) + 'px,' + (-ny * 10).toFixed(1) + 'px,0)';
      });
      t.addEventListener('pointerleave', function () { art.style.transform = ''; });
    });
  }

  /* ------------------------------------------------------------------
     4. Phone glare: a glass reflection on the phone that slides with the tilt.
     Added to the phone container only; the screen content is untouched.
     ------------------------------------------------------------------ */
  function glare() {
    if (!fine || reduce) return;
    var phone = $('.phone'), hero = $('.hero');
    if (!phone || !hero) return;
    var g = mk('fx-glare', 'i');
    phone.appendChild(g);
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      g.style.setProperty('--gx', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { g.style.setProperty('--gx', '0'); });
  }

  /* ------------------------------------------------------------------
     5. Partner card: holographic foil (moves with scroll via --p, set by the
     core script, and with the pointer via --hx/--hy) and a warm glow behind.
     ------------------------------------------------------------------ */
  function card() {
    var gc = $('.gcard'), stage = $('.card-stage');
    if (!gc || !stage) return;
    var holo = mk('gc-holo', 'i');
    gc.insertBefore(holo, gc.firstChild);
    stage.insertBefore(mk('gc-glow'), stage.firstChild);
    root.classList.add('fx-card');
  }

  /* ------------------------------------------------------------------
     6. Waitlist: a light that runs around the form card's border, and a
     smooth height change when the form turns into the success message.
     ------------------------------------------------------------------ */
  function waitlist() {
    var cardEl = $('#wlCard');
    if (!cardEl || reduce) return;
    var tr = mk('wl-trace');
    tr.innerHTML = '<i></i>';
    cardEl.insertBefore(tr, cardEl.firstChild);
    var lastH = cardEl.offsetHeight, flipped = cardEl.classList.contains('done');
    function sizeTrace() {
      tr.style.setProperty('--d', (Math.ceil(Math.hypot(cardEl.offsetWidth, cardEl.offsetHeight)) + 8) + 'px');
      if (!cardEl.classList.contains('done')) lastH = cardEl.offsetHeight;
    }
    sizeTrace();
    if ('ResizeObserver' in window) new ResizeObserver(sizeTrace).observe(cardEl);
    if ('MutationObserver' in window && cardEl.animate) {
      new MutationObserver(function () {
        if (flipped || !cardEl.classList.contains('done')) return;
        flipped = true;
        var h = cardEl.offsetHeight;
        if (Math.abs(h - lastH) > 4) cardEl.animate([{ height: lastH + 'px' }, { height: h + 'px' }], { duration: 750, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      }).observe(cardEl, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ------------------------------------------------------------------
     7. Eyebrow labels (01, 02 ... "Stay in the loop") decode into place.
     The final text is exactly what's in the HTML.
     ------------------------------------------------------------------ */
  function eyebrows() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var L = 'ABCDEFGHJKLMNPRSTUVWXYZ', D = '0123456789';
    function run(el) {
      var final = el.textContent, n = final.length, start = performance.now(), dur = 900;
      el.style.width = el.getBoundingClientRect().width + 'px';
      el.style.whiteSpace = 'nowrap';
      (function tick() {
        var t = (performance.now() - start) / dur, out = '';
        for (var i = 0; i < n; i++) {
          var ch = final[i];
          if (ch === ' ' || t > 0.25 + (i / n) * 0.7) out += ch;
          else out += (/\d/.test(ch) ? D : L)[(Math.random() * (/\d/.test(ch) ? 10 : 23)) | 0];
        }
        el.textContent = out;
        if (t < 1) setTimeout(tick, 45); else { el.textContent = final; el.style.width = ''; el.style.whiteSpace = ''; }
      })();
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); setTimeout(function () { run(en.target); }, 150); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    $$('.eyebrow').forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     8-10 need GSAP; they start when the core script says it's ready.
     ------------------------------------------------------------------ */

  /* 8. Odometer: each digit column rolls through 0-9 and lands on the real
     value. The original markup is put back when the roll ends. */
  function odometer() {
    $$('[data-count]').forEach(function (el, idx) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return; // already in view: leave it
      var orig = el.innerHTML, cols = [], html = '';
      Array.prototype.forEach.call(el.childNodes, function (node) {
        if (node.nodeType === 3) {
          node.nodeValue.split('').forEach(function (ch) {
            if (/\d/.test(ch)) {
              var d = +ch, spins = 1 + cols.length, cells = '';
              for (var k = 0; k < spins * 10 + d + 1; k++) cells += '<span>' + (k % 10) + '</span>';
              html += '<span class="odo"><span data-n="' + (spins * 10 + d) + '" data-t="' + (spins * 10 + d + 1) + '">' + cells + '</span></span>';
              cols.push(1);
            } else html += '<span class="odo-c">' + ch + '</span>';
          });
        } else html += '<span class="odo-c">' + node.outerHTML + '</span>';
      });
      el.innerHTML = html;
      var strips = $$('.odo > span', el);
      ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: function () {
        var tl = gsap.timeline({ onComplete: function () { el.innerHTML = orig; } });
        strips.forEach(function (s, i) {
          tl.to(s, { yPercent: -100 * (+s.dataset.n) / (+s.dataset.t), duration: 1.9 + i * 0.25, ease: 'expo.out' }, i * 0.08 + idx * 0.05);
        });
      } });
    });
  }

  /* 9. Partner card depth + roadmap rail head */
  function cardDepth() {
    var stage = $('.card-stage'), gc = $('.gcard'), safeEl = $('.safe'), col = $('.next-left');
    if (stage && gc && safeEl) {
      // The "Safe to spend" panel drifts at its own pace while the card is sticky
      gsap.fromTo(safeEl, { y: 50 }, { y: -40, ease: 'none', scrollTrigger: { trigger: '#next', start: 'top bottom', end: 'bottom top', scrub: true } });
      if (fine && col) {
        gsap.set(safeEl, { z: 70 });
        var rx = gsap.quickTo(stage, 'rotationX', { duration: 1, ease: 'power3' }), ry = gsap.quickTo(stage, 'rotationY', { duration: 1, ease: 'power3' });
        gsap.set(stage, { transformPerspective: 1400 });
        var layers = [[$('.gc-top', gc), 8], [$('.gc-chip', gc), 14], [$('.gc-bot', gc), 5]];
        col.addEventListener('pointermove', function (e) {
          var r = stage.getBoundingClientRect(), nx = clamp((e.clientX - r.left) / r.width - 0.5, -1, 1), ny = clamp((e.clientY - r.top) / r.height - 0.5, -1, 1);
          ry(nx * 10); rx(-ny * 8);
          gc.style.setProperty('--hx', (nx + 0.5).toFixed(3)); gc.style.setProperty('--hy', (ny + 0.5).toFixed(3));
          layers.forEach(function (l) { if (l[0]) l[0].style.transform = 'translate3d(' + (nx * l[1]).toFixed(1) + 'px,' + (ny * l[1] * 0.6).toFixed(1) + 'px,0)'; });
        });
        col.addEventListener('pointerleave', function () { rx(0); ry(0); layers.forEach(function (l) { if (l[0]) l[0].style.transform = ''; }); });
      }
    }
    var rail = $('.next-rail');
    if (rail) {
      var dot = mk('rail-dot', 'b');
      rail.appendChild(dot);
      // Each step number lights up as the glowing head reaches it
      var lis = $$('.next-list li'), marks = [];
      function mark() { marks = lis.map(function (li) { return li.offsetTop + parseFloat(getComputedStyle(li, '::before').top) - rail.offsetTop; }); }
      gsap.fromTo(dot, { y: 0 }, { y: function () { return rail.offsetHeight; }, ease: 'none',
        scrollTrigger: { trigger: '.next-list', start: 'top 75%', end: 'bottom 60%', scrub: true, invalidateOnRefresh: true, onRefresh: mark,
          onUpdate: function () { var y = gsap.getProperty(dot, 'y') + 6; lis.forEach(function (li, i) { li.classList.toggle('lit', y >= marks[i]); }); } } });
      mark();
      root.classList.add('fx-rail');
    }
  }

  /* 10. Scroll velocity: section headings lean a little with speed, then settle. */
  function velocity() {
    var L = window.GR && window.GR.lenis;
    if (!fine || !L) return;
    var els = $$('.h2, .ftr-word');
    var to = els.map(function (el) { return gsap.quickTo(el, 'skewY', { duration: 0.6, ease: 'power3' }); });
    var last = 0, rest;
    function lean(v) { last = v; for (var i = 0; i < to.length; i++) to[i](v); }
    L.on('scroll', function (e) {
      var v = clamp(-(e.velocity || 0) * 0.07, -2, 2);
      clearTimeout(rest); rest = setTimeout(function () { lean(0); }, 120);   // always settle back to straight
      if (Math.abs(v - last) >= 0.05) lean(v);
    });
  }

  safe(sheets); safe(cursor); safe(tiles); safe(glare); safe(card); safe(waitlist); safe(eyebrows);

  document.addEventListener('gr:motion', function () {
    if (!window.gsap || !window.ScrollTrigger) return;
    safe(odometer); safe(cardDepth); safe(velocity);
    ScrollTrigger.refresh();
  });
})();
