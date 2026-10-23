/* Get Real: hero background shader (raw WebGL, no libraries).
 *
 * A slow, domain-warped noise field in the brand colours (ink, violet, coral, orange)
 * that bends gently toward the cursor and drifts as you scroll.
 *
 * Fallbacks: the CSS orbs in .aurora stay in the page and are only hidden once the
 * first shader frame has been drawn (html.js .hero.gl-on). Nothing runs when:
 *   - JS is off, or the user prefers reduced motion (html.rm)
 *   - WebGL is unavailable or the shader fails to compile
 *   - the device can't keep up (auto-degrade lowers resolution, then gives up)
 * It also pauses when the hero is off-screen or the tab is hidden.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  if (root.classList.contains('rm')) return;
  var hero = document.querySelector('.hero');
  var host = hero && hero.querySelector('.aurora');
  if (!host || !window.WebGLRenderingContext) return;

  var touch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  var small = window.innerWidth < 760;

  var canvas = document.createElement('canvas');
  canvas.className = 'hero-gl';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!gl) return;

  // Lighter shader on phones: fewer noise octaves.
  var OCT = touch || small ? 3 : 4;

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;      // canvas size in device px',
    'uniform float uVh;      // one viewport height in canvas px',
    'uniform float uTime;',
    'uniform vec2 uMouse;    // cursor, in the same units as q below',
    'uniform float uHover;   // 0..1, cursor present',
    'uniform float uScroll;  // 0..1 through the hero',
    '#define OCT ' + OCT,
    'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    '  return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);',
    '  for(int i=0;i<OCT;i++){v+=a*n(p);p=r*p*2.03+11.7;a*=.5;}return v;}',
    'void main(){',
    '  // q: x centred, y measured down from the top of the hero, both in viewport heights',
    '  vec2 q=vec2(gl_FragCoord.x-uRes.x*.5,uRes.y-gl_FragCoord.y)/uVh;',
    '  float t=uTime*.045;',
    '  vec2 m=q-uMouse; float md=dot(m,m);',
    '  vec2 p=q*1.35+vec2(0.,uScroll*.9);',
    '  p+=m*.18*exp(-md*5.)*uHover;            // the field leans toward the cursor',
    '  vec2 a=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));',
    '  vec2 b=vec2(fbm(p+2.6*a+vec2(1.7,9.2)+t*1.3),fbm(p+2.6*a+vec2(8.3,2.8)-t*1.1));',
    '  float f=fbm(p+2.2*b);',
    '  // Light pools in the brand colours, pushed around by the noise field',
    '  vec2 w=q+(b-.5)*.6;',
    '  float ah=uRes.x/uVh*.5;                                   // half width, in viewport heights',
    '  vec2 c1=vec2(-max(ah*.72,.3)+.10*sin(t*3.1),.02+.07*cos(t*2.3));  // orange, top left',
    '  vec2 c2=vec2( max(ah*.70,.3)+.08*cos(t*2.7),.30+.06*sin(t*3.3));  // coral, right',
    '  vec2 c3=vec2(.18*sin(t*1.7),-.18);                        // violet, top centre',
    '  vec2 c4=vec2(.25*cos(t*2.1),.62);                         // warm, low centre',
    '  float g1=exp(-dot(w-c1,w-c1)*2.8), g2=exp(-dot(w-c2,w-c2)*3.2), g3=exp(-dot(w-c3,w-c3)*2.2), g4=exp(-dot(w-c4,w-c4)*4.);',
    '  float s=smoothstep(.32,.72,f);                            // shaped noise: more visible flow',
    '  vec3 ink=vec3(.055,.055,.118), deep=vec3(.09,.085,.19), vio=vec3(.36,.27,.78);',
    '  vec3 cor=vec3(.91,.33,.25), org=vec3(1.,.42,.21), pea=vec3(1.,.6,.42);',
    '  vec3 c=mix(ink,deep,smoothstep(.25,.85,f));',
    '  c+=vio*g3*(.25+.75*s)*.6;',
    '  c+=org*g1*(.15+s)*.85;',
    '  c+=cor*g2*(.15+s)*.75;',
    '  c+=pea*g4*s*.1;',
    '  c+=org*pow(g1*s,2.)*.7+cor*pow(g2*s,2.)*.5;             // hot cores',
    '  c+=pea*smoothstep(.6,.9,f)*(g1+g2)*.22;                  // brighter filaments inside the pools',
    '  // keep it calm behind the headline and let it fade toward the horizon',
    '  float top=smoothstep(1.3,.1,q.y);',
    '  float calm=1.-.3*exp(-pow(q.y-.3,2.)*9.-q.x*q.x*1.4);',
    '  c=mix(ink,c,top*calm);',
    '  c+=org*.16*exp(-md*7.)*uHover;           // soft light under the cursor',
    '  c+=(h(gl_FragCoord.xy+fract(uTime))-.5)/255.;   // dither: no banding',
    '  gl_FragColor=vec4(c,1.);',
    '}'
  ].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['uRes', 'uVh', 'uTime', 'uMouse', 'uHover', 'uScroll'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

  host.appendChild(canvas);

  /* Resolution: the field is soft, so it renders well below screen resolution and is
     upscaled by the browser. `scale` drops further if the device struggles. */
  var scale = touch || small ? 0.32 : 0.5, W = 0, H = 0, vh = 0, heroH = 1;
  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);   // DPR capped: the field is soft anyway
    W = Math.max(2, Math.round(host.clientWidth * dpr * scale));
    H = Math.max(2, Math.round(host.clientHeight * dpr * scale));
    vh = window.innerHeight * dpr * scale;
    heroH = Math.max(hero.offsetHeight, 1);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
  }
  size();
  var rz;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { size(); if (!running) draw(now()); }, 120); });

  /* Inputs: cursor (desktop only) and how far the hero has scrolled. */
  var mx = 0, my = 0.4, tmx = 0, tmy = 0.4, hov = 0, thov = 0;
  if (!touch) {
    hero.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      tmx = (e.clientX - r.left - r.width / 2) / window.innerHeight;
      tmy = (e.clientY - r.top) / window.innerHeight;
      thov = 1;
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { thov = 0; });
  }

  var t0 = performance.now(), running = false, visible = true, raf = 0, frames = 0, last = 0, skip = false;
  var slow = [], dead = false;
  function now() { return performance.now(); }

  function draw(ts) {
    var sc = Math.min(Math.max(window.scrollY / heroH, 0), 1);
    mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06; hov += (thov - hov) * 0.04;
    gl.uniform2f(U.uRes, W, H);
    gl.uniform1f(U.uVh, vh);
    gl.uniform1f(U.uTime, (ts - t0) / 1000);
    gl.uniform2f(U.uMouse, mx, my);
    gl.uniform1f(U.uHover, hov);
    gl.uniform1f(U.uScroll, sc);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    // Phones: 30fps is plenty for a slow-moving field.
    if (touch) { skip = !skip; if (skip) return; }
    // Auto-degrade: once the intro has settled, watch real frame gaps for ~1s.
    if (last && slow !== null && ts - t0 > 2600) {
      slow.push(ts - last);
      if (slow.length === 50) {
        slow.sort(function (a, b) { return a - b; });
        var med = slow[25], budget = touch ? 45 : 26;
        if (med > budget) {
          if (scale > 0.2) { scale *= 0.6; size(); slow = []; }
          else { kill(); return; }
        } else { slow = null; } // healthy: stop measuring
      }
    }
    last = ts;
    draw(ts);
    if (++frames === 2) hero.classList.add('gl-on');
  }
  function play() { if (!running && visible && !document.hidden && !dead) { running = true; last = 0; raf = requestAnimationFrame(loop); } }
  function pause() { running = false; cancelAnimationFrame(raf); }
  function kill() {
    dead = true; pause(); hero.classList.remove('gl-on');
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) play(); else pause(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else play(); });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); kill(); });
  play();
})();
