/**
 * Evil0ctopus — living cyber digital ocean background (canvas 2D).
 * Deep navy/cyan underwater expanse with layered depth (near/mid/far),
 * filled kelp/data-strand silhouettes, digital reef + coral forms,
 * volumetric caustic shafts, bioluminescent clusters, bubble trails,
 * multi-depth fish schools, sonar rings, signal blooms, a faint trench
 * horizon glow, and a current-grid as one layer among many.
 *
 * Honors prefers-reduced-motion (static still frame).
 * Pauses when document.hidden.
 *
 * Intensity via CSS variables on :root:
 *   --bg-ocean-opacity
 *   --bg-ocean-current-alpha
 *   --bg-ocean-speed
 *   --bg-ocean-particle-density
 */
(function () {
  'use strict';

  var host = document.querySelector('.site-bg');
  if (!host) return;

  host.querySelectorAll('.site-bg-hex, .site-bg-node').forEach(function (el) {
    el.remove();
  });

  var canvas = host.querySelector('.site-bg-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'site-bg-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);
  }

  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  host.classList.remove('has-live-landscape');
  host.classList.add('has-live-ocean');

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  var dpr = 1;
  var w = 0;
  var h = 0;
  var raf = 0;
  var running = false;
  var lastFrame = 0;
  var targetFps = 40;
  var frameInterval = 1000 / targetFps;

  // Scene state
  var currents = [];
  var rays = [];
  var particles = [];
  var kelp = [];
  var reefs = [];
  var schools = [];
  var pulses = [];
  var rings = [];
  var blooms = [];
  var causticSpots = [];
  var corals = [];
  var bubbleTrails = [];
  var softShafts = [];
  var farDrift = 0;
  var midDrift = 0;

  var CYAN = [34, 211, 238];
  var TEAL = [15, 118, 110];
  var DEEP = [8, 12, 18];
  var MID = [10, 28, 38];
  var LITE = [103, 232, 249];
  var AQUA = [45, 212, 191];

  function cssNum(name, fallback) {
    var raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    var n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a.toFixed(3) + ')';
  }

  function seeded(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function buildScene() {
    currents = [];
    rays = [];
    particles = [];
    kelp = [];
    reefs = [];
    schools = [];
    pulses = [];
    rings = [];
    blooms = [];
    causticSpots = [];
    corals = [];
    bubbleTrails = [];
    softShafts = [];

    var narrow = w < 640;
    var mid = w < 1100;
    var density = cssNum('--bg-ocean-particle-density', 1);
    density = Math.max(0.35, Math.min(1.6, density));

    var i, j, r, r2, r3, r4;

    // Perspective current / wave-grid — fewer, softer (one layer among many)
    var bandCount = narrow ? 7 : mid ? 10 : 12;
    for (i = 0; i < bandCount; i++) {
      var t = (i + 1) / (bandCount + 1);
      var depth = Math.pow(t, 1.25);
      currents.push({
        depth: depth,
        phase: seeded(i * 4.1 + 1) * Math.PI * 2,
        amp: (3 + seeded(i * 2.7) * 8) * (0.35 + depth),
        freq: 1.1 + seeded(i * 3.3) * 1.6,
        speed: 0.3 + seeded(i * 5.1) * 0.55,
        thick: 0.55 + depth * 1.15,
        layer: depth < 0.4 ? 'far' : depth < 0.7 ? 'mid' : 'near'
      });
    }

    // Sparse vertical meridians
    var vCount = narrow ? 5 : 8;
    for (i = 0; i < vCount; i++) {
      currents.push({
        vertical: true,
        u: (i / (vCount - 1)) * 1.35 - 0.175,
        phase: seeded(i * 8.2 + 9) * Math.PI * 2
      });
    }

    // Caustic light shafts — denser, varied
    var rayCount = Math.round((narrow ? 6 : mid ? 9 : 13) * density);
    for (i = 0; i < rayCount; i++) {
      r = seeded(i * 6.17 + 2);
      r2 = seeded(i * 9.3 + 3);
      r3 = seeded(i * 11.1 + 3.5);
      rays.push({
        x: r * w,
        lean: (r2 - 0.5) * 0.42,
        width: (narrow ? 22 : 34) + r * (narrow ? 55 : 100),
        phase: r2 * Math.PI * 2,
        speed: 0.12 + r * 0.4,
        bright: 0.65 + r2 * 0.55,
        soft: r3 > 0.45
      });
    }

    // Soft volumetric shafts (wider, fainter, mid-depth fill)
    var shaftCount = narrow ? 3 : mid ? 4 : 6;
    for (i = 0; i < shaftCount; i++) {
      r = seeded(i * 21.4 + 88);
      r2 = seeded(i * 22.8 + 89);
      softShafts.push({
        x: r * w,
        lean: (r2 - 0.5) * 0.28,
        width: (narrow ? 70 : 110) + r * (narrow ? 80 : 140),
        phase: r2 * Math.PI * 2,
        speed: 0.08 + r * 0.22,
        bright: 0.35 + r2 * 0.4
      });
    }

    // Surface caustic spots (shimmer blobs, not a grid) — richer texture
    var spotCount = Math.round((narrow ? 12 : mid ? 20 : 28) * density);
    for (i = 0; i < spotCount; i++) {
      r = seeded(i * 14.2 + 50);
      r2 = seeded(i * 15.7 + 51);
      r3 = seeded(i * 16.3 + 52);
      causticSpots.push({
        x: r * w,
        y: h * (0.02 + r2 * 0.22),
        r: 6 + r * 32,
        phase: r2 * Math.PI * 2,
        speed: 0.35 + r * 0.85,
        bright: 0.45 + r2 * 0.55,
        stretch: 0.35 + r3 * 0.35
      });
    }

    // Particles — varied sizes, more presence (extra glow / bubble bias)
    var pCount = Math.round((narrow ? 85 : mid ? 145 : 200) * density);
    for (i = 0; i < pCount; i++) {
      r = seeded(i * 1.91 + 4);
      r2 = seeded(i * 2.53 + 5);
      r3 = seeded(i * 3.17 + 6);
      r4 = seeded(i * 4.01 + 7);
      var kind = r > 0.72 ? 'bubble' : r > 0.52 ? 'mote' : r > 0.28 ? 'spark' : 'glow';
      particles.push({
        x: r * w,
        y: r2 * h,
        z: 0.2 + r3 * 0.8,
        size: kind === 'glow'
          ? 2.2 + r * 4.8
          : kind === 'bubble'
            ? 1.4 + r * 3.4
            : 0.5 + r * 2.2 * (0.5 + r3),
        driftX: (r2 - 0.5) * 22,
        driftY: -(6 + r * 26),
        phase: r3 * Math.PI * 2,
        kind: kind,
        blink: 0.35 + r2 * 2.4,
        layer: r4 < 0.33 ? 'far' : r4 < 0.66 ? 'mid' : 'near'
      });
    }

    // Bubble trails — short rising chains of bubbles
    var trailCount = narrow ? 4 : mid ? 7 : 10;
    for (i = 0; i < trailCount; i++) {
      r = seeded(i * 44.1 + 100);
      r2 = seeded(i * 45.7 + 101);
      r3 = seeded(i * 46.3 + 102);
      var bubbles = [];
      var bN = 4 + Math.floor(r * 5);
      for (j = 0; j < bN; j++) {
        bubbles.push({
          ox: (seeded(i * 60 + j) - 0.5) * 10,
          oy: j * (10 + r2 * 8),
          size: 1.1 + seeded(i * 61 + j) * 2.4,
          phase: seeded(i * 62 + j) * Math.PI * 2
        });
      }
      bubbleTrails.push({
        x: r * w,
        y: h * (0.45 + r2 * 0.45),
        speed: 12 + r3 * 22,
        wobble: 8 + r * 14,
        phase: r * Math.PI * 2,
        bubbles: bubbles,
        layer: r3 < 0.4 ? 'mid' : 'near',
        alpha: 0.35 + r2 * 0.4
      });
    }

    // Kelp / data strands — thicker filled ribbons; extra mid-ground clusters
    var kCount = Math.round((narrow ? 11 : mid ? 17 : 24) * Math.min(1.25, density));
    for (i = 0; i < kCount; i++) {
      r = seeded(i * 7.7 + 11);
      r2 = seeded(i * 4.4 + 12);
      r3 = seeded(i * 5.9 + 13);
      // Bias mid layer (~50%) for more mid-ground interest
      var layer = r3 < 0.22 ? 'far' : r3 < 0.72 ? 'mid' : 'near';
      var thickBase = layer === 'near' ? 3.5 : layer === 'mid' ? 2.2 : 1.3;
      // Cluster offset: some strands share an x-neighborhood
      var cluster = Math.floor(i / 3);
      var clusterX = seeded(cluster * 9.1 + 14) * w;
      var xPos = (i % 3 === 0)
        ? r * w
        : clusterX + (seeded(i * 8.2 + 15) - 0.5) * w * 0.07;
      kelp.push({
        x: ((xPos % w) + w) % w,
        baseY: h * (0.5 + r2 * 0.48),
        height: h * (0.26 + r * 0.5),
        sway: 14 + r2 * 36,
        phase: r * Math.PI * 2,
        segments: narrow ? 8 : 12,
        alpha: layer === 'near' ? 0.3 + r2 * 0.26 : layer === 'mid' ? 0.18 + r2 * 0.2 : 0.09 + r2 * 0.11,
        nodes: Math.round(4 + r * 7),
        thick: thickBase + r * 2.2,
        layer: layer,
        branch: r3 > 0.5
      });
    }

    // Rocky / digital reef silhouettes near bottom — extra shelves
    var reefCount = narrow ? 5 : mid ? 8 : 11;
    for (i = 0; i < reefCount; i++) {
      r = seeded(i * 17.3 + 60);
      r2 = seeded(i * 18.1 + 61);
      r3 = seeded(i * 19.7 + 62);
      var peaks = [];
      var peakN = 4 + Math.floor(r * 6);
      for (j = 0; j <= peakN; j++) {
        peaks.push({
          u: j / peakN,
          h: 0.12 + seeded(i * 40 + j) * 0.88,
          dig: seeded(i * 41 + j + 0.3) > 0.5
        });
      }
      reefs.push({
        x: (r - 0.08) * w,
        width: w * (0.12 + r2 * 0.2),
        height: h * (0.07 + r3 * 0.15),
        peaks: peaks,
        alpha: 0.32 + r2 * 0.35,
        teal: r3 > 0.4,
        shelf: r3 > 0.55
      });
    }

    // Faint coral-like digital structures (angular fans / polyps)
    var coralCount = narrow ? 5 : mid ? 8 : 12;
    for (i = 0; i < coralCount; i++) {
      r = seeded(i * 27.1 + 120);
      r2 = seeded(i * 28.4 + 121);
      r3 = seeded(i * 29.7 + 122);
      var arms = [];
      var armN = 3 + Math.floor(r * 4);
      for (j = 0; j < armN; j++) {
        arms.push({
          ang: -Math.PI * 0.55 + (j / Math.max(1, armN - 1)) * Math.PI * 1.1 + (seeded(i * 70 + j) - 0.5) * 0.25,
          len: 10 + seeded(i * 71 + j) * 28,
          thick: 1 + seeded(i * 72 + j) * 1.8,
          nodes: 2 + Math.floor(seeded(i * 73 + j) * 3)
        });
      }
      corals.push({
        x: r * w,
        y: h * (0.72 + r2 * 0.24),
        arms: arms,
        alpha: 0.18 + r3 * 0.28,
        phase: r * Math.PI * 2,
        teal: r2 > 0.45,
        layer: r3 < 0.35 ? 'mid' : 'near'
      });
    }

    // Fish schools — more fish + second depth layer (far / mid / near)
    var sCount = narrow ? 4 : mid ? 6 : 8;
    for (i = 0; i < sCount; i++) {
      r = seeded(i * 11.1 + 20);
      r2 = seeded(i * 13.7 + 21);
      r3 = seeded(i * 15.3 + 22);
      var layerS = r3 < 0.3 ? 'far' : r3 < 0.65 ? 'mid' : 'near';
      var members = [];
      var mBase = layerS === 'near' ? (narrow ? 8 : 12) : (narrow ? 11 : mid ? 17 : 24);
      var mCount = Math.round(mBase * density);
      var spreadX = layerS === 'far' ? 40 + r3 * 20 : layerS === 'mid' ? 55 + r3 * 30 : 70 + r3 * 35;
      var spreadY = layerS === 'far' ? 14 + r * 10 : layerS === 'mid' ? 20 + r * 14 : 24 + r * 16;
      for (j = 0; j < mCount; j++) {
        members.push({
          ox: (seeded(i * 50 + j) - 0.5) * spreadX,
          oy: (seeded(i * 50 + j + 0.5) - 0.5) * spreadY,
          phase: seeded(i * 30 + j * 2) * Math.PI * 2,
          size: (layerS === 'far' ? 1.2 : layerS === 'mid' ? 1.6 : 1.9) + seeded(i * 31 + j) * 2.2,
          flashPhase: seeded(i * 32 + j + 1) * Math.PI * 2
        });
      }
      schools.push({
        x: r * w,
        y: h * (layerS === 'far' ? 0.18 + r2 * 0.35 : layerS === 'mid' ? 0.28 + r2 * 0.4 : 0.35 + r2 * 0.4),
        vx: (layerS === 'far' ? 10 : 14) + r * (layerS === 'near' ? 38 : 32),
        vy: (r2 - 0.5) * 10,
        phase: r * Math.PI * 2,
        members: members,
        dir: r > 0.5 ? 1 : -1,
        layer: layerS,
        cohesion: 0.32 + r2 * 0.42
      });
    }

    // Signal pulses along current bands
    var puCount = Math.round((narrow ? 5 : 9) * density);
    for (i = 0; i < puCount; i++) {
      r = seeded(i * 19.3 + 30);
      pulses.push({
        band: Math.floor(r * Math.max(1, bandCount)),
        t: seeded(i * 21.1 + 31),
        speed: 0.07 + seeded(i * 23 + 32) * 0.16,
        bright: 0.7 + seeded(i * 25 + 33) * 0.5,
        wide: 0.05 + seeded(i * 27 + 34) * 0.07
      });
    }

    // Soft expanding sonar / signal rings
    var riCount = narrow ? 3 : 5;
    for (i = 0; i < riCount; i++) {
      r = seeded(i * 31.5 + 40);
      r2 = seeded(i * 33.1 + 41);
      rings.push({
        x: w * (0.15 + r * 0.7),
        y: h * (0.3 + r2 * 0.45),
        phase: r * Math.PI * 2,
        period: 5 + r2 * 6.5,
        maxR: 50 + r * 120,
        stagger: r2 * 0.35
      });
    }

    // Distant signal blooms / bioluminescent clusters
    var blCount = narrow ? 5 : mid ? 8 : 11;
    for (i = 0; i < blCount; i++) {
      r = seeded(i * 37.2 + 70);
      r2 = seeded(i * 38.9 + 71);
      r3 = seeded(i * 40.1 + 72);
      blooms.push({
        x: r * w,
        y: h * (0.18 + r2 * 0.6),
        r: 14 + r3 * 58,
        phase: r * Math.PI * 2,
        period: 3.2 + r2 * 5.2,
        bright: 0.4 + r3 * 0.55,
        tealBias: r2 > 0.5,
        cluster: r3 > 0.6
      });
    }
  }

  function resize() {
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, w < 640 ? 1.2 : 1.7);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildScene();
  }

  function surfaceY() {
    return Math.floor(h * 0.07);
  }

  function depthY(depth) {
    var surf = surfaceY();
    return surf + Math.pow(depth, 0.85) * (h - surf);
  }

  function layerOffset(layer, now, speed) {
    if (reduceMotion) return 0;
    var t = now * 0.001 * speed;
    if (layer === 'far') return Math.sin(t * 0.12 + farDrift) * 6;
    if (layer === 'mid') return Math.sin(t * 0.22 + midDrift) * 12;
    return Math.sin(t * 0.35) * 4;
  }

  function drawDepthGradient() {
    // Deeper navy blacks, stronger cyan/teal presence near surface
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(14, 48, 62, 0.98)');
    g.addColorStop(0.12, 'rgba(10, 34, 48, 1)');
    g.addColorStop(0.35, 'rgba(8, 20, 30, 1)');
    g.addColorStop(0.65, 'rgba(6, 12, 20, 1)');
    g.addColorStop(1, 'rgba(4, 8, 12, 1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Stronger teal mid bloom
    var bloom = ctx.createRadialGradient(
      w * 0.48, h * 0.16, 8,
      w * 0.5, h * 0.42, Math.max(w, h) * 0.72
    );
    bloom.addColorStop(0, 'rgba(34, 211, 238, 0.14)');
    bloom.addColorStop(0.35, 'rgba(15, 118, 110, 0.09)');
    bloom.addColorStop(0.7, 'rgba(8, 40, 48, 0.04)');
    bloom.addColorStop(1, 'rgba(4, 8, 12, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);

    // Soft seabed fade — silt / deep teal floor
    var bed = ctx.createLinearGradient(0, h * 0.72, 0, h);
    bed.addColorStop(0, 'rgba(4, 8, 12, 0)');
    bed.addColorStop(0.45, 'rgba(6, 22, 28, 0.45)');
    bed.addColorStop(1, 'rgba(3, 14, 18, 0.85)');
    ctx.fillStyle = bed;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);

    // Very subtle distant trench horizon glow (far depth cue)
    var trench = ctx.createRadialGradient(
      w * 0.5, h * 0.92, 4,
      w * 0.5, h * 0.98, Math.max(w * 0.55, 180)
    );
    trench.addColorStop(0, 'rgba(15, 118, 110, 0.11)');
    trench.addColorStop(0.45, 'rgba(34, 211, 238, 0.045)');
    trench.addColorStop(1, 'rgba(4, 8, 12, 0)');
    ctx.fillStyle = trench;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
  }

  function drawReefs(opacity) {
    var i, j;
    for (i = 0; i < reefs.length; i++) {
      var rf = reefs[i];
      var baseY = h + 2;
      ctx.beginPath();
      ctx.moveTo(rf.x, baseY);
      for (j = 0; j < rf.peaks.length; j++) {
        var pk = rf.peaks[j];
        var px = rf.x + pk.u * rf.width;
        var py = baseY - pk.h * rf.height;
        if (pk.dig) {
          // Angular digital ledge
          var prevX = j === 0 ? rf.x : rf.x + rf.peaks[j - 1].u * rf.width;
          var midX = (prevX + px) * 0.5;
          ctx.lineTo(midX, py + rf.height * 0.12);
          ctx.lineTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.lineTo(rf.x + rf.width, baseY);
      ctx.closePath();

      var rg = ctx.createLinearGradient(0, baseY - rf.height, 0, baseY);
      if (rf.teal) {
        rg.addColorStop(0, rgba(TEAL, 0.55 * opacity * rf.alpha));
        rg.addColorStop(0.55, rgba(MID, 0.7 * opacity * rf.alpha));
        rg.addColorStop(1, rgba(DEEP, 0.9 * opacity * rf.alpha));
      } else {
        rg.addColorStop(0, rgba(CYAN, 0.18 * opacity * rf.alpha));
        rg.addColorStop(0.4, rgba(MID, 0.65 * opacity * rf.alpha));
        rg.addColorStop(1, rgba(DEEP, 0.95 * opacity * rf.alpha));
      }
      ctx.fillStyle = rg;
      ctx.fill();

      // Sparse cyan edge highlights (digital reef ridges)
      ctx.strokeStyle = rgba(CYAN, 0.22 * opacity * rf.alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (j = 0; j < rf.peaks.length; j++) {
        pk = rf.peaks[j];
        px = rf.x + pk.u * rf.width;
        py = baseY - pk.h * rf.height;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Extra mid-height shelf ledge on some reefs
      if (rf.shelf) {
        var sy = baseY - rf.height * 0.42;
        ctx.strokeStyle = rgba(AQUA, 0.16 * opacity * rf.alpha);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(rf.x + rf.width * 0.12, sy);
        ctx.lineTo(rf.x + rf.width * 0.88, sy + rf.height * 0.04);
        ctx.stroke();
        ctx.fillStyle = rgba(TEAL, 0.12 * opacity * rf.alpha);
        ctx.fillRect(rf.x + rf.width * 0.18, sy, rf.width * 0.55, 2.5);
      }
    }
  }

  function drawCaustics(opacity, now, speed) {
    var surf = surfaceY();
    var i;

    // Soft volumetric shafts first (wide, faint fill behind sharper rays)
    for (i = 0; i < softShafts.length; i++) {
      var sh = softShafts[i];
      var shSway = reduceMotion
        ? Math.sin(sh.phase) * 10
        : Math.sin(now * 0.00022 * speed * sh.speed + sh.phase) * 22;
      var sx0 = sh.x + shSway;
      var sx1 = sx0 + sh.lean * h;
      var shHalf = sh.width * 0.5;
      var shA = 0.1 * opacity * sh.bright;
      if (!reduceMotion) {
        shA *= 0.75 + 0.25 * Math.sin(now * 0.0004 * speed + sh.phase);
      }
      var shG = ctx.createLinearGradient(sx0, surf, sx1, h * 0.85);
      shG.addColorStop(0, rgba(LITE, shA * 0.55));
      shG.addColorStop(0.35, rgba(CYAN, shA * 0.35));
      shG.addColorStop(0.7, rgba(AQUA, shA * 0.12));
      shG.addColorStop(1, rgba(DEEP, 0));
      ctx.beginPath();
      ctx.moveTo(sx0 - shHalf * 0.5, surf);
      ctx.lineTo(sx0 + shHalf * 0.5, surf);
      ctx.lineTo(sx1 + shHalf * 1.4, h);
      ctx.lineTo(sx1 - shHalf * 1.4, h);
      ctx.closePath();
      ctx.fillStyle = shG;
      ctx.fill();
    }

    for (i = 0; i < rays.length; i++) {
      var ray = rays[i];
      var sway;
      if (reduceMotion) {
        sway = Math.sin(ray.phase) * 16;
      } else {
        sway = Math.sin(now * 0.00032 * speed * ray.speed + ray.phase) * 32
          + Math.sin(now * 0.00018 * speed + ray.phase * 1.7) * 10;
      }
      var x0 = ray.x + sway;
      var x1 = x0 + ray.lean * h + Math.sin(ray.phase + 1.2) * 24;
      var half = ray.width * 0.5;

      var grad = ctx.createLinearGradient(x0, surf, x1, h);
      var a0 = (ray.soft ? 0.18 : 0.26) * opacity * ray.bright;
      grad.addColorStop(0, rgba(LITE, a0 * 0.95));
      grad.addColorStop(0.22, rgba(CYAN, a0 * 0.62));
      grad.addColorStop(0.55, rgba(AQUA, a0 * 0.28));
      grad.addColorStop(0.82, rgba(TEAL, a0 * 0.1));
      grad.addColorStop(1, rgba(DEEP, 0));

      ctx.beginPath();
      ctx.moveTo(x0 - half * 0.35, surf);
      ctx.lineTo(x0 + half * 0.35, surf);
      ctx.lineTo(x1 + half * 1.7, h);
      ctx.lineTo(x1 - half * 1.7, h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Surface caustic spots — organic shimmer, richer texture
    for (i = 0; i < causticSpots.length; i++) {
      var sp = causticSpots[i];
      var sx = sp.x;
      var sy = sp.y;
      var sr = sp.r;
      var stretch = sp.stretch || 0.45;
      var sa = 0.2 * opacity * sp.bright;
      if (!reduceMotion) {
        var st = now * 0.001 * speed * sp.speed;
        sx += Math.sin(st + sp.phase) * 28;
        sy += Math.cos(st * 0.7 + sp.phase) * 8;
        sr *= 0.75 + 0.35 * Math.sin(st * 1.3 + sp.phase);
        sa *= 0.55 + 0.45 * Math.sin(st * 1.6 + sp.phase * 2);
      }
      var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      sg.addColorStop(0, rgba(LITE, sa));
      sg.addColorStop(0.35, rgba(CYAN, sa * 0.5));
      sg.addColorStop(0.7, rgba(AQUA, sa * 0.18));
      sg.addColorStop(1, rgba(CYAN, 0));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr, sr * stretch, Math.sin(sp.phase) * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // Tiny secondary caustic fleck for richer texture
      if (i % 3 === 0) {
        var fx = sx + sr * 0.55;
        var fy = sy + sr * 0.15;
        var fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, sr * 0.35);
        fg.addColorStop(0, rgba(LITE, sa * 0.55));
        fg.addColorStop(1, rgba(CYAN, 0));
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.ellipse(fx, fy, sr * 0.35, sr * stretch * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Soft surface shimmer band
    var shim = ctx.createLinearGradient(0, 0, 0, surf + h * 0.14);
    var shimmerA = 0.28 * opacity;
    if (!reduceMotion) {
      shimmerA *= 0.8 + 0.2 * Math.sin(now * 0.0011 * speed);
    }
    shim.addColorStop(0, rgba(CYAN, shimmerA * 0.65));
    shim.addColorStop(0.45, rgba(LITE, shimmerA * 0.32));
    shim.addColorStop(1, rgba(DEEP, 0));
    ctx.fillStyle = shim;
    ctx.fillRect(0, 0, w, surf + h * 0.16);
  }

  function bandPath(band, now, speed, yBase, xOff) {
    var amp = band.amp;
    var phase = band.phase;
    if (!reduceMotion) {
      phase += now * 0.0005 * speed * band.speed;
    }
    xOff = xOff || 0;
    ctx.beginPath();
    var x;
    var step = w < 640 ? 16 : 11;
    for (x = -20; x <= w + 20; x += step) {
      var nx = (x + xOff) / w;
      var y = yBase + Math.sin(nx * Math.PI * 2 * band.freq + phase) * amp
        + Math.sin(nx * Math.PI * 3.5 + phase * 0.65) * amp * 0.22;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  function drawCurrents(opacity, currentA, now, speed) {
    var i;
    var vpX = w * 0.5;
    var surf = surfaceY();

    // Vertical converging lanes — subtle
    for (i = 0; i < currents.length; i++) {
      var c = currents[i];
      if (!c.vertical) continue;
      var xNear = c.u * w;
      var xFar = vpX + (xNear - vpX) * 0.1;
      ctx.beginPath();
      ctx.moveTo(xFar, surf + 4);
      ctx.lineTo(xNear, h + 4);
      ctx.strokeStyle = rgba(CYAN, currentA * opacity * 0.16);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Horizontal depth wave currents — present but not dominant
    for (i = 0; i < currents.length; i++) {
      var band = currents[i];
      if (band.vertical) continue;
      var xOff = layerOffset(band.layer, now, speed);
      var y = depthY(band.depth);
      var fade = 0.28 + band.depth * 0.55;
      bandPath(band, now, speed, y, xOff);
      ctx.strokeStyle = rgba(CYAN, currentA * opacity * fade * 0.7);
      ctx.lineWidth = band.thick;
      ctx.stroke();

      bandPath(band, now, speed, y, xOff);
      ctx.strokeStyle = rgba(TEAL, currentA * opacity * fade * 0.28);
      ctx.lineWidth = band.thick + 2.2;
      ctx.stroke();
    }
  }

  function drawPulses(opacity, now, speed) {
    if (reduceMotion) return;
    var bands = currents.filter(function (c) { return !c.vertical; });
    if (!bands.length) return;
    var i;
    for (i = 0; i < pulses.length; i++) {
      var pu = pulses[i];
      var band = bands[pu.band % bands.length];
      if (!band) continue;
      var t = (pu.t + now * 0.001 * speed * pu.speed) % 1;
      var x = t * w;
      var yBase = depthY(band.depth);
      var phase = band.phase + now * 0.0005 * speed * band.speed;
      var nx = x / w;
      var y = yBase + Math.sin(nx * Math.PI * 2 * band.freq + phase) * band.amp;

      var glow = 7 + pu.bright * 10;
      var g = ctx.createRadialGradient(x, y, 0, x, y, glow);
      g.addColorStop(0, rgba(LITE, 0.85 * opacity * pu.bright));
      g.addColorStop(0.35, rgba(CYAN, 0.5 * opacity * pu.bright));
      g.addColorStop(1, rgba(CYAN, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, glow, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = rgba(CYAN, 0.4 * opacity * pu.bright);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      var trail = pu.wide * w;
      ctx.moveTo(x - trail, y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  function drawKelp(opacity, now, speed, layerFilter) {
    var i, s;
    for (i = 0; i < kelp.length; i++) {
      var k = kelp[i];
      if (layerFilter && k.layer !== layerFilter) continue;
      var swayPhase = k.phase;
      if (!reduceMotion) {
        swayPhase += now * 0.00038 * speed;
      }
      var xOff = layerOffset(k.layer, now, speed);

      // Build centerline points
      var pts = [];
      var segs = k.segments;
      for (s = 0; s <= segs; s++) {
        var u = s / segs;
        var yy = k.baseY - u * k.height;
        var xx = k.x + xOff + Math.sin(swayPhase + u * 2.6) * k.sway * u
          + Math.sin(swayPhase * 0.6 + u * 4.1) * k.sway * 0.2 * u;
        pts.push({ x: xx, y: yy, u: u });
      }

      // Filled thick ribbon (silhouette with thickness)
      ctx.beginPath();
      for (s = 0; s < pts.length; s++) {
        var halfT = k.thick * (0.35 + pts[s].u * 0.65);
        if (s === 0) ctx.moveTo(pts[s].x - halfT, pts[s].y);
        else ctx.lineTo(pts[s].x - halfT, pts[s].y);
      }
      for (s = pts.length - 1; s >= 0; s--) {
        halfT = k.thick * (0.35 + pts[s].u * 0.65);
        ctx.lineTo(pts[s].x + halfT, pts[s].y);
      }
      ctx.closePath();

      var kg = ctx.createLinearGradient(0, k.baseY - k.height, 0, k.baseY);
      kg.addColorStop(0, rgba(CYAN, k.alpha * opacity * 0.35));
      kg.addColorStop(0.4, rgba(TEAL, k.alpha * opacity * 0.85));
      kg.addColorStop(1, rgba(DEEP, k.alpha * opacity * 1.1));
      ctx.fillStyle = kg;
      ctx.fill();

      // Bright edge stroke
      ctx.beginPath();
      for (s = 0; s < pts.length; s++) {
        if (s === 0) ctx.moveTo(pts[s].x, pts[s].y);
        else ctx.lineTo(pts[s].x, pts[s].y);
      }
      ctx.strokeStyle = rgba(CYAN, k.alpha * opacity * 0.9);
      ctx.lineWidth = Math.max(1, k.thick * 0.28);
      ctx.stroke();

      // Optional secondary branch
      if (k.branch && pts.length > 4) {
        var mid = Math.floor(pts.length * 0.45);
        ctx.beginPath();
        ctx.moveTo(pts[mid].x, pts[mid].y);
        var bx = pts[mid].x + (k.layer === 'near' ? 18 : 10) * Math.sin(swayPhase + 1);
        var by = pts[mid].y - k.height * 0.22;
        ctx.quadraticCurveTo(
          pts[mid].x + 8,
          pts[mid].y - k.height * 0.1,
          bx, by
        );
        ctx.strokeStyle = rgba(TEAL, k.alpha * opacity * 0.7);
        ctx.lineWidth = Math.max(1, k.thick * 0.35);
        ctx.stroke();
      }

      // Data nodes along strand
      for (s = 1; s <= k.nodes; s++) {
        var u2 = s / (k.nodes + 1);
        var idx = Math.min(pts.length - 1, Math.round(u2 * (pts.length - 1)));
        var p = pts[idx];
        var on = reduceMotion
          ? seeded(i * 10 + s) > 0.35
          : Math.sin(now * 0.0022 * speed + k.phase + s) > -0.25;
        if (!on) continue;
        var na = (0.4 + u2 * 0.4) * opacity;
        ctx.fillStyle = rgba(LITE, na * 0.85);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2 + k.thick * 0.15, 0, Math.PI * 2);
        ctx.fill();
        // Soft glow
        var ng = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 5);
        ng.addColorStop(0, rgba(CYAN, na * 0.35));
        ng.addColorStop(1, rgba(CYAN, 0));
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawParticles(opacity, density, now, speed, layerFilter) {
    var dens = Math.max(0.25, density);
    var i;
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (layerFilter && p.layer !== layerFilter) continue;
      var x, y;
      var xOff = layerOffset(p.layer, now, speed);
      if (reduceMotion) {
        x = p.x + xOff;
        y = p.y;
      } else {
        var t = now * 0.001 * speed;
        x = (p.x + t * p.driftX + Math.sin(t * 0.7 + p.phase) * 12 + w * 2) % (w + 20) - 10;
        x += xOff;
        y = (p.y + t * p.driftY + h * 3) % (h + 30) - 15;
      }

      var a;
      if (reduceMotion) {
        a = 0.42 * opacity * dens * p.z;
      } else {
        var blink = 0.5 + 0.5 * Math.sin(now * 0.0016 * speed * p.blink + p.phase);
        a = (0.3 + 0.5 * blink) * opacity * dens * p.z;
      }

      if (p.kind === 'bubble') {
        ctx.strokeStyle = rgba(LITE, a * 0.85);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 1.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = rgba(CYAN, a * 0.18);
        ctx.fill();
        // Highlight speck
        ctx.fillStyle = rgba(LITE, a * 0.55);
        ctx.beginPath();
        ctx.arc(x - p.size * 0.35, y - p.size * 0.35, Math.max(0.6, p.size * 0.22), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'glow') {
        var gg = ctx.createRadialGradient(x, y, 0, x, y, p.size);
        gg.addColorStop(0, rgba(LITE, a * 0.7));
        gg.addColorStop(0.35, rgba(CYAN, a * 0.4));
        gg.addColorStop(1, rgba(CYAN, 0));
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = rgba(LITE, a);
        ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      } else {
        ctx.fillStyle = rgba(CYAN, a);
        ctx.beginPath();
        ctx.arc(x, y, p.size * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSchools(opacity, now, speed, layerFilter) {
    var i, j;
    for (i = 0; i < schools.length; i++) {
      var sc = schools[i];
      if (layerFilter && sc.layer !== layerFilter) continue;
      var cx, cy;
      var layerA = sc.layer === 'far' ? 0.5 : sc.layer === 'mid' ? 0.82 : 1;
      if (reduceMotion) {
        cx = sc.x;
        cy = sc.y;
      } else {
        var t = now * 0.001 * speed;
        cx = (sc.x + t * sc.vx * sc.dir + w * 2) % (w + 80) - 40;
        cy = sc.y + Math.sin(t * 0.32 + sc.phase) * 22 + t * sc.vy * 0.12;
        cy = ((cy % (h + 50)) + h + 50) % (h + 50) - 25;
      }

      // Soft school haze
      var haze = ctx.createRadialGradient(cx, cy, 4, cx, cy, 55);
      haze.addColorStop(0, rgba(CYAN, 0.06 * opacity * layerA));
      haze.addColorStop(1, rgba(CYAN, 0));
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 55, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      for (j = 0; j < sc.members.length; j++) {
        var m = sc.members[j];
        var mx = cx + m.ox * sc.cohesion;
        var my = cy + m.oy * sc.cohesion;
        if (!reduceMotion) {
          // Slight flocking: neighbors pull toward center + lateral wave
          mx += Math.sin(now * 0.0022 + m.phase) * 4
            + Math.sin(now * 0.0011 + sc.phase + j * 0.3) * 2.5;
          my += Math.cos(now * 0.0019 + m.phase) * 2.5
            + Math.sin(now * 0.0014 + m.phase * 1.3) * 1.8;
        }

        var flash = 0;
        if (!reduceMotion) {
          flash = Math.sin(now * 0.0035 * speed + m.flashPhase);
        } else {
          flash = seeded(i * 20 + j) > 0.7 ? 0.5 : -0.5;
        }
        var fa = (0.32 + (flash > 0.75 ? 0.45 : flash > 0.4 ? 0.15 : 0)) * opacity * layerA;

        var ang = sc.dir > 0 ? -0.25 : Math.PI + 0.25;
        ctx.fillStyle = rgba(flash > 0.75 ? LITE : CYAN, fa);
        ctx.beginPath();
        ctx.ellipse(mx, my, m.size, m.size * 0.45, ang, 0, Math.PI * 2);
        ctx.fill();

        if (flash > 0.75) {
          var fg = ctx.createRadialGradient(mx, my, 0, mx, my, m.size * 3);
          fg.addColorStop(0, rgba(LITE, 0.35 * opacity * layerA));
          fg.addColorStop(1, rgba(LITE, 0));
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(mx, my, m.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawRings(opacity, now, speed) {
    var i, rg;
    if (reduceMotion) {
      for (i = 0; i < rings.length; i++) {
        rg = rings[i];
        ctx.strokeStyle = rgba(CYAN, 0.14 * opacity);
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.maxR * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }
    for (i = 0; i < rings.length; i++) {
      rg = rings[i];
      var cycle = ((now * 0.001 * speed + rg.phase * 0.5 + rg.stagger) % rg.period) / rg.period;
      var radius = cycle * rg.maxR;
      var a = (1 - cycle) * 0.36 * opacity;
      if (a < 0.02) continue;
      ctx.strokeStyle = rgba(CYAN, a);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba(TEAL, a * 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      // Inner soft fill bloom
      if (cycle < 0.35) {
        var rgFill = ctx.createRadialGradient(rg.x, rg.y, 0, rg.x, rg.y, radius * 0.5);
        rgFill.addColorStop(0, rgba(CYAN, a * 0.25));
        rgFill.addColorStop(1, rgba(CYAN, 0));
        ctx.fillStyle = rgFill;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBlooms(opacity, now, speed) {
    var i;
    for (i = 0; i < blooms.length; i++) {
      var bl = blooms[i];
      var pulse;
      if (reduceMotion) {
        pulse = 0.45;
      } else {
        var cyc = ((now * 0.001 * speed + bl.phase) % bl.period) / bl.period;
        // Soft attack/decay envelope — occasional blooms
        pulse = cyc < 0.15
          ? cyc / 0.15
          : cyc < 0.55
            ? 1 - ((cyc - 0.15) / 0.4) * 0.3
            : Math.max(0, 1 - (cyc - 0.55) / 0.45);
        pulse *= pulse;
      }
      var a = pulse * 0.3 * opacity * bl.bright;
      if (a < 0.015) continue;
      var col = bl.tealBias ? AQUA : CYAN;
      var bg = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, bl.r);
      bg.addColorStop(0, rgba(LITE, a * 0.7));
      bg.addColorStop(0.3, rgba(col, a * 0.55));
      bg.addColorStop(0.7, rgba(TEAL, a * 0.2));
      bg.addColorStop(1, rgba(DEEP, 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bl.x, bl.y, bl.r, 0, Math.PI * 2);
      ctx.fill();
      // Satellite motes for denser bioluminescent clusters
      if (bl.cluster) {
        var k;
        for (k = 0; k < 3; k++) {
          var ang = bl.phase + k * 2.1;
          var dist = bl.r * (0.35 + k * 0.12);
          var bx = bl.x + Math.cos(ang) * dist;
          var by = bl.y + Math.sin(ang) * dist * 0.55;
          var br = bl.r * (0.18 + k * 0.05);
          var ba = a * (0.45 - k * 0.1);
          var sg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          sg.addColorStop(0, rgba(LITE, ba * 0.8));
          sg.addColorStop(0.5, rgba(col, ba * 0.4));
          sg.addColorStop(1, rgba(DEEP, 0));
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawCorals(opacity, now, speed, layerFilter) {
    var i, j, n;
    for (i = 0; i < corals.length; i++) {
      var c = corals[i];
      if (layerFilter && c.layer !== layerFilter) continue;
      var sway = reduceMotion ? 0 : Math.sin(now * 0.00045 * speed + c.phase) * 3;
      var col = c.teal ? TEAL : CYAN;
      var a = c.alpha * opacity;
      for (j = 0; j < c.arms.length; j++) {
        var arm = c.arms[j];
        var ex = c.x + Math.cos(arm.ang) * arm.len + sway;
        var ey = c.y + Math.sin(arm.ang) * arm.len * 0.85;
        ctx.strokeStyle = rgba(col, a * 0.85);
        ctx.lineWidth = arm.thick;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.quadraticCurveTo(
          c.x + Math.cos(arm.ang) * arm.len * 0.4 + sway * 0.5,
          c.y - arm.len * 0.15,
          ex, ey
        );
        ctx.stroke();
        // Soft digital nodes along arm
        for (n = 1; n <= arm.nodes; n++) {
          var u = n / (arm.nodes + 1);
          var nx = c.x + (ex - c.x) * u;
          var ny = c.y + (ey - c.y) * u;
          var on = reduceMotion
            ? seeded(i * 20 + j * 5 + n) > 0.3
            : Math.sin(now * 0.002 * speed + c.phase + n) > -0.2;
          if (!on) continue;
          ctx.fillStyle = rgba(LITE, a * 0.7);
          ctx.beginPath();
          ctx.arc(nx, ny, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Base polyp glow
      var pg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 10);
      pg.addColorStop(0, rgba(LITE, a * 0.35));
      pg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBubbleTrails(opacity, now, speed, layerFilter) {
    var i, j;
    for (i = 0; i < bubbleTrails.length; i++) {
      var tr = bubbleTrails[i];
      if (layerFilter && tr.layer !== layerFilter) continue;
      var tx, ty;
      if (reduceMotion) {
        tx = tr.x;
        ty = tr.y;
      } else {
        var t = now * 0.001 * speed;
        tx = tr.x + Math.sin(t * 0.55 + tr.phase) * tr.wobble;
        ty = (tr.y - t * tr.speed + h * 4) % (h + 60) - 30;
      }
      for (j = 0; j < tr.bubbles.length; j++) {
        var b = tr.bubbles[j];
        var bx = tx + b.ox;
        var by = ty - b.oy;
        if (!reduceMotion) {
          bx += Math.sin(now * 0.0018 * speed + b.phase) * 3;
        }
        var ba = tr.alpha * opacity * (0.45 + 0.55 * (j / tr.bubbles.length));
        ctx.strokeStyle = rgba(LITE, ba * 0.8);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, b.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = rgba(CYAN, ba * 0.15);
        ctx.fill();
        ctx.fillStyle = rgba(LITE, ba * 0.45);
        ctx.beginPath();
        ctx.arc(bx - b.size * 0.3, by - b.size * 0.3, Math.max(0.5, b.size * 0.2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function draw(now) {
    var opacity = cssNum('--bg-ocean-opacity', 0.92);
    var currentA = cssNum('--bg-ocean-current-alpha', 0.62);
    var speed = cssNum('--bg-ocean-speed', 1);
    var density = cssNum('--bg-ocean-particle-density', 1.15);

    if (!reduceMotion) {
      farDrift = now * 0.00005;
      midDrift = now * 0.00009;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    // Far layer
    drawDepthGradient();
    drawCaustics(opacity, now, speed);
    drawBlooms(opacity * 0.8, now, speed);
    drawKelp(opacity * 0.72, now, speed, 'far');
    drawParticles(opacity * 0.65, density, now, speed, 'far');

    // Mid layer — currents live here as one element among many
    drawCurrents(opacity, currentA, now, speed);
    drawKelp(opacity * 0.95, now, speed, 'mid');
    drawCorals(opacity * 0.75, now, speed, 'mid');
    drawPulses(opacity, now, speed);
    drawSchools(opacity * 0.85, now, speed, 'far');
    drawSchools(opacity, now, speed, 'mid');
    drawParticles(opacity * 0.95, density, now, speed, 'mid');
    drawBubbleTrails(opacity * 0.85, now, speed, 'mid');
    drawRings(opacity, now, speed);

    // Near layer
    drawKelp(opacity, now, speed, 'near');
    drawReefs(opacity);
    drawCorals(opacity, now, speed, 'near');
    drawSchools(opacity, now, speed, 'near');
    drawParticles(opacity, density, now, speed, 'near');
    drawBubbleTrails(opacity, now, speed, 'near');
  }

  function frame(now) {
    if (!running) return;
    if (now - lastFrame >= frameInterval - 1) {
      lastFrame = now;
      draw(now);
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    lastFrame = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else if (!reduceMotion) start();
  });

  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var onMq = function () {
      reduceMotion = mq.matches;
      stop();
      resize();
      draw(performance.now());
      if (!reduceMotion && !document.hidden) start();
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  } catch (e) {}

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      draw(performance.now());
    }, 100);
  });

  resize();
  draw(performance.now());
  if (!reduceMotion) start();
})();
