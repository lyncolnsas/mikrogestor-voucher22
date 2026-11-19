export function getNicheEffectMarkup(
  bgEffect: string,
  speed: string = 'normal',
  brand: string = '#2563eb',
  brandDark: string = '#1d4ed8',
  blue: string = '#2563eb',
  green: string = '#10b981'
) {
  let bgHtml = '';
  let cssEffects = '';
  let jsEffects = '';

  const spdMult = speed === 'fast' ? 2 : speed === 'slow' ? 0.5 : 1;

  // Helper template for robust mobile-first canvas bootstrap
  const canvasBootstrap = (canvasId: string, initJs: string, bgCol: string = 'transparent') => {
    return `(function() {
  var c = document.getElementById('${canvasId}');
  if (!c) return;
  var ctx = c.getContext('2d');
  if (!ctx) return;
  var animId = null;
  function resize() {
    var w = c.clientWidth || window.innerWidth || document.documentElement.clientWidth || (window.screen && window.screen.width) || 360;
    var h = c.clientHeight || window.innerHeight || document.documentElement.clientHeight || (window.screen && window.screen.height) || 640;
    if (w > 0 && h > 0 && (c.width !== w || c.height !== h)) {
      c.width = w;
      c.height = h;
    }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function() { setTimeout(resize, 60); setTimeout(resize, 300); });
  document.addEventListener('DOMContentLoaded', resize);
  window.addEventListener('load', resize);
  resize();
  setTimeout(resize, 80);
  setTimeout(resize, 400);

  ${initJs}
})();`;
  };

  switch (bgEffect) {
    case 'cardio-pulse':
    case 'academia':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#080a0c;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var sparks = []; var step = 0;
  function addSpark(px, py) {
    for (var i = 0; i < 6; i++) {
      sparks.push({ x: px, y: py, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 1 });
    }
  }
  function draw() {
    ctx.fillStyle = 'rgba(8, 10, 12, 0.1)'; ctx.fillRect(0, 0, c.width, c.height);
    step += ${speed === 'fast' ? 3.5 : speed === 'slow' ? 1.2 : 2.2};
    var cx = (step * 3) % c.width;
    var cy = c.height * 0.55;
    var mod = (step * 3) % 220;
    var amp = Math.min(90, c.height * 0.16);
    if (mod > 60 && mod < 75) cy -= amp * 0.35;
    else if (mod >= 75 && mod < 85) cy += amp * 0.2;
    else if (mod >= 85 && mod < 100) { cy -= amp; if (mod === 90) addSpark(cx, cy); }
    else if (mod >= 100 && mod < 115) cy += amp * 0.45;
    else if (mod >= 115 && mod < 135) cy -= amp * 0.25;

    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '${brand}'; ctx.shadowBlur = 12; ctx.shadowColor = '${green}'; ctx.fill(); ctx.shadowBlur = 0;

    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i]; s.x += s.vx; s.y += s.vy; s.life -= 0.035;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.8 * s.life, 0, Math.PI * 2);
      ctx.fillStyle = '${green}'; ctx.shadowBlur = 8; ctx.shadowColor = '${green}'; ctx.fill(); ctx.shadowBlur = 0;
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'divine-rays':
    case 'igreja':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#04060f;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var stars = [];
  for (var i = 0; i < 40; i++) {
    stars.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: Math.random() * 2 + 0.8, vy: -(Math.random() * 0.6 + 0.2) });
  }
  var angle = 0;
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    angle += ${speed === 'fast' ? 0.005 : speed === 'slow' ? 0.001 : 0.0025};
    var numRays = 7; var cx = c.width / 2;
    var len = Math.hypot(c.width, c.height) * 1.3;
    for (var r = 0; r < numRays; r++) {
      var a = angle + (r * Math.PI / numRays) - Math.PI / 2;
      ctx.save(); ctx.beginPath(); ctx.moveTo(cx, -20);
      var a1 = a - 0.12; var a2 = a + 0.12;
      ctx.lineTo(cx + Math.sin(a1) * len, Math.cos(a1) * len - 20);
      ctx.lineTo(cx + Math.sin(a2) * len, Math.cos(a2) * len - 20);
      ctx.closePath();
      var grad = ctx.createLinearGradient(cx, 0, cx, c.height);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
      grad.addColorStop(0.6, 'rgba(217, 119, 6, 0.08)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad; ctx.fill(); ctx.restore();
    }
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s]; st.y += st.vy; if (st.y < 0) { st.y = c.height; st.x = Math.random() * c.width; }
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = '${brand}'; ctx.shadowBlur = 10; ctx.shadowColor = '${brand}'; ctx.fill(); ctx.shadowBlur = 0;
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'medical-vital':
    case 'clinica':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#030914;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var cells = [];
  for (var i = 0; i < 22; i++) {
    cells.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: Math.random() * 14 + 8, vx: (Math.random() - 0.5) * 0.4, vy: -(Math.random() * 0.5 + 0.2) });
  }
  function draw() {
    ctx.fillStyle = 'rgba(3, 9, 20, 0.22)'; ctx.fillRect(0, 0, c.width, c.height);
    for (var i = 0; i < cells.length; i++) {
      var cl = cells[i]; cl.x += cl.vx; cl.y += cl.vy;
      if (cl.y < -30) { cl.y = c.height + 30; cl.x = Math.random() * c.width; }
      if (cl.x < -30) cl.x = c.width + 30; if (cl.x > c.width + 30) cl.x = -30;
      ctx.beginPath(); ctx.arc(cl.x, cl.y, cl.r, 0, Math.PI * 2);
      ctx.strokeStyle = '${brand}'; ctx.lineWidth = 1.2; ctx.stroke();
      var cs = cl.r * 0.45;
      ctx.beginPath(); ctx.moveTo(cl.x - cs, cl.y); ctx.lineTo(cl.x + cs, cl.y);
      ctx.moveTo(cl.x, cl.y - cs); ctx.lineTo(cl.x, cl.y + cs);
      ctx.strokeStyle = '${green}'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'woodfire-embers':
    case 'pizzaria':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#0c0607;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var embers = [];
  for (var i = 0; i < 45; i++) {
    embers.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: Math.random() * 2.8 + 1, vx: (Math.random() - 0.5) * 1.4, vy: -(Math.random() * 1.8 + 0.8), alpha: Math.random() });
  }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    var gradR = Math.min(c.height * 0.65, c.width * 0.9);
    var grad = ctx.createRadialGradient(c.width / 2, c.height + 40, 10, c.width / 2, c.height, gradR);
    grad.addColorStop(0, 'rgba(225, 29, 72, 0.28)');
    grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, c.width, c.height);
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i]; e.x += e.vx + Math.sin(e.y * 0.02) * 0.8; e.y += e.vy; e.alpha -= 0.003;
      if (e.y < -10 || e.alpha <= 0) { e.y = c.height + 10; e.x = Math.random() * c.width; e.alpha = 1; }
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = e.r > 2 ? '${brand}' : '${green}'; ctx.shadowBlur = 10; ctx.shadowColor = '${brand}'; ctx.fill(); ctx.shadowBlur = 0;
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'luxury-bubbles':
    case 'hotel':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#090703;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var bubs = [];
  for (var i = 0; i < 45; i++) {
    bubs.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: Math.random() * 3.5 + 1.2, vy: -(Math.random() * 1.5 + 0.5) * spdM, wobble: Math.random() * Math.PI * 2, sparkle: Math.random() > 0.65 });
  }
  var t = 0;
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); t += 0.03 * spdM;
    var grad = ctx.createLinearGradient(0, c.height * 0.4, 0, c.height);
    grad.addColorStop(0, 'rgba(217, 119, 6, 0)');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0.08)');
    ctx.fillStyle = grad; ctx.fillRect(0, c.height * 0.4, c.width, c.height * 0.6);
    for (var i = 0; i < bubs.length; i++) {
      var b = bubs[i]; b.y += b.vy; b.wobble += 0.04 * spdM;
      var wx = b.x + Math.sin(b.wobble) * 2;
      if (b.y < -15) { b.y = c.height + 15; b.x = Math.random() * c.width; }
      ctx.beginPath(); ctx.arc(wx, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(wx - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.fill();
      if (b.sparkle && (i + Math.floor(t * 3)) % 7 === 0) {
        var sz = b.r * 2.2;
        ctx.beginPath();
        ctx.moveTo(wx, b.y - sz); ctx.lineTo(wx + sz * 0.25, b.y); ctx.lineTo(wx + sz, b.y); ctx.lineTo(wx + sz * 0.25, b.y); ctx.lineTo(wx, b.y + sz); ctx.lineTo(wx - sz * 0.25, b.y); ctx.lineTo(wx - sz, b.y); ctx.lineTo(wx - sz * 0.25, b.y);
        ctx.closePath(); ctx.fillStyle = '#fef08a'; ctx.fill();
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'stadium-lights':
    case 'futebol_copa':
    case 'fifa-26.otf':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#020d06;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var angle = 0;
  var dust = [];
  for (var i = 0; i < 30; i++) {
    dust.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: Math.random() * 1.8 + 0.6, vx: (Math.random() - 0.5) * 0.4 * spdM, vy: (Math.random() - 0.5) * 0.4 * spdM });
  }
  var flashPos = { x: 0, y: 0, active: false, rad: 0 };
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); angle += 0.012 * spdM;
    var turfGrad = ctx.createLinearGradient(0, c.height * 0.6, 0, c.height);
    turfGrad.addColorStop(0, 'rgba(22, 163, 74, 0)'); turfGrad.addColorStop(1, 'rgba(22, 163, 74, 0.12)');
    ctx.fillStyle = turfGrad; ctx.fillRect(0, c.height * 0.6, c.width, c.height * 0.4);
    var towers = [
      { x: 0, y: 0, a: Math.sin(angle * 0.8) * 0.25 + 0.75, len: c.height * 1.5, col: 'rgba(34, 197, 94, 0.22)' },
      { x: c.width, y: 0, a: Math.PI * 0.75 - Math.cos(angle * 0.7) * 0.25, len: c.height * 1.5, col: 'rgba(56, 189, 248, 0.22)' },
      { x: c.width * 0.2, y: 0, a: Math.cos(angle * 0.9) * 0.2 + Math.PI * 0.5, len: c.height * 1.3, col: 'rgba(255, 255, 255, 0.15)' },
      { x: c.width * 0.8, y: 0, a: -Math.sin(angle * 0.9) * 0.2 + Math.PI * 0.5, len: c.height * 1.3, col: 'rgba(34, 197, 94, 0.18)' }
    ];
    towers.forEach(function(t) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(t.x, t.y);
      var endX = t.x + Math.cos(t.a) * t.len; var endY = t.y + Math.sin(t.a) * t.len;
      var spread = Math.min(75, c.width * 0.18);
      ctx.lineTo(endX - spread, endY); ctx.lineTo(endX + spread, endY); ctx.closePath();
      var grad = ctx.createLinearGradient(t.x, t.y, endX, endY);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)'); grad.addColorStop(0.25, t.col); grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad; ctx.fill(); ctx.restore();
    });
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i]; d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = c.width; if (d.x > c.width) d.x = 0;
      if (d.y < 0) d.y = c.height; if (d.y > c.height) d.y = 0;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; ctx.fill();
    }
    if (!flashPos.active && Math.random() < 0.035 * spdM) {
      flashPos = { x: Math.random() * c.width, y: c.height * (0.55 + Math.random() * 0.4), active: true, rad: 2 };
    }
    if (flashPos.active) {
      flashPos.rad += 3 * spdM;
      ctx.beginPath(); ctx.arc(flashPos.x, flashPos.y, flashPos.rad, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + Math.max(0, 1 - flashPos.rad / 22) + ')';
      ctx.lineWidth = 1.8; ctx.stroke();
      if (flashPos.rad > 22) flashPos.active = false;
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'digital-ocean':
    case 'Digital_Ocean':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#01050e;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var beacons = [];
  for (var i = 0; i < 14; i++) {
    beacons.push({ x: Math.random() * (c.width || 360), y: (c.height || 640), vy: (Math.random() * 3 + 2) * spdM, len: Math.random() * 50 + 30 });
  }
  var t = 0;
  function draw() {
    ctx.fillStyle = 'rgba(1, 5, 14, 0.28)'; ctx.fillRect(0, 0, c.width, c.height); t += 0.025 * spdM;
    var horizonY = c.height * 0.45; var numGridZ = 16;
    for (var gz = 1; gz <= numGridZ; gz++) {
      var zNorm = gz / numGridZ; var yBase = horizonY + (c.height - horizonY) * (zNorm * zNorm);
      ctx.strokeStyle = 'rgba(6, 182, 212, ' + (zNorm * 0.6) + ')';
      ctx.beginPath();
      var stepX = Math.max(14, Math.floor(c.width / 26));
      for (var gx = 0; gx <= c.width; gx += stepX) {
        var wave = Math.sin(gx * 0.008 + t * 2 + gz * 0.5) * Math.cos(gx * 0.004 - t) * (18 * zNorm);
        var y = yBase + wave;
        if (gx === 0) ctx.moveTo(gx, y); else ctx.lineTo(gx, y);
      }
      ctx.stroke();
    }
    for (var b = 0; b < beacons.length; b++) {
      var bc = beacons[b]; bc.y -= bc.vy;
      if (bc.y < -60) { bc.y = c.height + 20; bc.x = Math.random() * c.width; }
      var bGrad = ctx.createLinearGradient(bc.x, bc.y + bc.len, bc.x, bc.y);
      bGrad.addColorStop(0, 'rgba(6, 182, 212, 0)'); bGrad.addColorStop(1, '#38bdf8');
      ctx.beginPath(); ctx.moveTo(bc.x, bc.y + bc.len); ctx.lineTo(bc.x, bc.y);
      ctx.strokeStyle = bGrad; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(bc.x, bc.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'cinema-marquee':
    case 'Popcorn':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#0a0405;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var frame = 0;
  var motes = [];
  for (var i = 0; i < 28; i++) {
    motes.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: Math.random() * 1.5 + 0.5, vx: (Math.random() - 0.5) * 0.3 * spdM, vy: (Math.random() * 0.4 + 0.2) * spdM });
  }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); frame += spdM;
    var pApexX = c.width / 2;
    var flicker = 0.14 + Math.sin(frame * 0.15) * 0.03 + Math.random() * 0.02;
    ctx.save(); ctx.beginPath(); ctx.moveTo(pApexX, 0);
    ctx.lineTo(pApexX - c.width * 0.45, c.height); ctx.lineTo(pApexX + c.width * 0.45, c.height); ctx.closePath();
    var pGrad = ctx.createRadialGradient(pApexX, 0, 10, pApexX, c.height * 0.6, c.height * 0.8);
    pGrad.addColorStop(0, 'rgba(254, 240, 138, ' + (flicker * 1.8) + ')');
    pGrad.addColorStop(0.5, 'rgba(250, 204, 21, ' + (flicker * 0.6) + ')');
    pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pGrad; ctx.fill(); ctx.restore();

    for (var m = 0; m < motes.length; m++) {
      var mo = motes[m]; mo.x += mo.vx; mo.y += mo.vy;
      if (mo.y > c.height) { mo.y = 0; mo.x = Math.random() * c.width; }
      ctx.beginPath(); ctx.arc(mo.x, mo.y, mo.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(254, 240, 138, 0.5)'; ctx.fill();
    }
    var bulbSpacing = Math.max(26, Math.floor(c.width / 12));
    var bulbRadius = Math.min(3.5, c.width * 0.012 + 1.5);
    var bulbPhase = Math.floor(frame / 6);
    function drawBulb(bx, by, idx) {
      var isOn = (idx + bulbPhase) % 3 === 0;
      ctx.beginPath(); ctx.arc(bx, by, bulbRadius, 0, Math.PI * 2);
      if (isOn) { ctx.fillStyle = '#fde047'; ctx.shadowBlur = 10; ctx.shadowColor = '#facc15'; } else { ctx.fillStyle = '#451a03'; ctx.shadowBlur = 0; }
      ctx.fill(); ctx.shadowBlur = 0;
    }
    var bIdx = 0;
    for (var x = 14; x < c.width - 14; x += bulbSpacing) { drawBulb(x, 14, bIdx++); drawBulb(x, c.height - 14, bIdx++); }
    for (var y = 14; y < c.height - 14; y += bulbSpacing) { drawBulb(14, y, bIdx++); drawBulb(c.width - 14, y, bIdx++); }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'chalk-constellation':
    case 'Escuela':
    case 'Greenboard':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#040d08;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var rot = 0;
  var electrons = [
    { a: 0, speed: 0.03, rxP: 0.55, ryP: 0.24, tilt: 0 },
    { a: 1.2, speed: -0.025, rxP: 0.78, ryP: 0.34, tilt: Math.PI / 3 },
    { a: 2.4, speed: 0.02, rxP: 0.95, ryP: 0.40, tilt: -Math.PI / 3 }
  ];
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); rot += 0.005 * spdM;
    var cx = c.width / 2; var cy = c.height / 2;
    var baseR = Math.min(Math.max(c.width * 0.52, 175), c.height * 0.4);
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.22)'; ctx.lineWidth = 1.2;
    if (ctx.setLineDash) ctx.setLineDash([4, 6]);
    [baseR * 0.32, baseR * 0.55, baseR * 0.78, baseR].forEach(function(r) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); });
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.25)';
    ctx.save(); ctx.rotate(rot); ctx.beginPath();
    for (var i = 0; i < 3; i++) {
      var a = (i * Math.PI * 2) / 3; var px = Math.cos(a) * (baseR * 0.55); var py = Math.sin(a) * (baseR * 0.55);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
    for (var i = 0; i < 24; i++) {
      var ta = (i * Math.PI * 2) / 24; ctx.beginPath();
      ctx.moveTo(Math.cos(ta) * (baseR * 0.76), Math.sin(ta) * (baseR * 0.76));
      ctx.lineTo(Math.cos(ta) * (baseR * 0.81), Math.sin(ta) * (baseR * 0.81));
      ctx.stroke();
    }
    ctx.restore();
    electrons.forEach(function(el) {
      el.a += el.speed * spdM; ctx.save(); ctx.rotate(el.tilt);
      var rx = baseR * el.rxP; var ry = baseR * el.ryP;
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); else ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.15)'; ctx.stroke();
      var ex = Math.cos(el.a) * rx; var ey = Math.sin(el.a) * ry;
      ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#6ee7b7'; ctx.shadowBlur = 8; ctx.shadowColor = '#6ee7b7'; ctx.fill(); ctx.shadowBlur = 0;
      ctx.restore();
    });
    ctx.restore();
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'traffic-radar':
    case 'Traffic-Control':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#020608;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var angle = 0;
  var targets = [
    { distP: 0.35, ang: 0.8, ping: 0, label: 'NOC-SP 12ms' },
    { distP: 0.62, ang: 2.3, ping: 0, label: 'DNS-01 4ms' },
    { distP: 0.88, ang: 4.1, ping: 0, label: 'GATEWAY 99%' },
    { distP: 0.52, ang: 5.4, ping: 0, label: 'BGP-PEER' }
  ];
  function draw() {
    ctx.fillStyle = 'rgba(2, 6, 8, 0.12)'; ctx.fillRect(0, 0, c.width, c.height);
    var cx = c.width / 2; var cy = c.height / 2;
    var maxR = Math.min(Math.max(c.width * 0.55, 185), c.height * 0.42);
    angle = (angle + 0.03 * spdM) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)'; ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(function(pct) { ctx.beginPath(); ctx.arc(cx, cy, maxR * pct, 0, Math.PI * 2); ctx.stroke(); });
    ctx.beginPath();
    ctx.moveTo(cx - maxR * 1.05, cy); ctx.lineTo(cx + maxR * 1.05, cy);
    ctx.moveTo(cx, cy - maxR * 1.05); ctx.lineTo(cx, cy + maxR * 1.05);
    ctx.stroke();

    var sweepArc = 0.5; var grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(34, 197, 94, 0.4)'); grad.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
    ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, maxR, angle - sweepArc, angle, false); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = '#22c55e'; ctx.stroke(); ctx.shadowBlur = 0; ctx.restore();

    targets.forEach(function(tgt) {
      var dist = maxR * tgt.distP;
      var tx = cx + Math.cos(tgt.ang) * dist; var ty = cy + Math.sin(tgt.ang) * dist;
      var angDiff = Math.abs(angle - tgt.ang); if (angDiff < 0.05) tgt.ping = 1;
      if (tgt.ping > 0) {
        tgt.ping -= 0.015 * spdM; var ripR = (1 - tgt.ping) * 26;
        ctx.beginPath(); ctx.arc(tx, ty, ripR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34, 197, 94, ' + tgt.ping + ')'; ctx.stroke();
        ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(34, 197, 94, ' + tgt.ping + ')'; ctx.fillText(tgt.label, tx + 8, ty - 4);
      } else {
        ctx.beginPath(); ctx.arc(tx, ty, 2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(34, 197, 94, 0.35)'; ctx.fill();
      }
    });
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'hex-shield':
    case 'shield':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#010912;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var waveR = 0;
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    var cx = c.width / 2; var cy = c.height / 2;
    var r = Math.max(18, Math.min(26, c.width * 0.06));
    var w = r * Math.sqrt(3); var h = r * 1.5;
    waveR = (waveR + 2.5 * spdM) % (Math.hypot(c.width, c.height) * 0.55);

    function drawHex(hx, hy, intensity) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = (i * Math.PI) / 3; var px = hx + r * Math.cos(a); var py = hy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (intensity > 0.1) {
        ctx.fillStyle = 'rgba(6, 182, 212, ' + (intensity * 0.35) + ')'; ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, ' + (intensity * 0.9) + ')'; ctx.lineWidth = 1.8; ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)'; ctx.lineWidth = 0.8; ctx.stroke();
      }
    }

    for (var y = -20; y < c.height + 40; y += h) {
      var row = Math.floor(y / h);
      for (var x = -20; x < c.width + 40; x += w) {
        var offX = (row % 2) * (w / 2); var hexX = x + offX; var hexY = y;
        var d = Math.hypot(hexX - cx, hexY - cy); var waveDist = Math.abs(d - waveR);
        var intensity = waveDist < 60 ? (1 - waveDist / 60) : 0;
        drawHex(hexX, hexY, intensity);
      }
    }
    ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 2; ctx.shadowBlur = 15; ctx.shadowColor = '#06b6d4'; ctx.stroke(); ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'lock-crypto':
    case 'wifi_lock':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#030511;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var a1 = 0, a2 = 0, a3 = 0;
  var hexChars = ['0x4F', 'AES', '9A', 'WPA3', '7C', 'SHA2', 'E1', 'KEY', '3B', '256'];
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    var cx = c.width / 2; var cy = c.height / 2;
    var baseR = Math.min(Math.max(c.width * 0.52, 175), c.height * 0.40);
    a1 += 0.008 * spdM; a2 -= 0.012 * spdM; a3 += 0.006 * spdM;

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a1);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, baseR, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '9px monospace'; ctx.fillStyle = '#818cf8';
    for (var i = 0; i < 12; i++) {
      var a = (i * Math.PI * 2) / 12; ctx.save(); ctx.rotate(a); ctx.fillText(hexChars[i % hexChars.length], baseR - 15, 3); ctx.restore();
    }
    ctx.restore();

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a2);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 0, baseR * 0.72, 0, Math.PI * 1.6); ctx.stroke();
    for (var i = 0; i < 20; i++) {
      var a = (i * Math.PI * 2) / 20; ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (baseR * 0.7), Math.sin(a) * (baseR * 0.7)); ctx.lineTo(Math.cos(a) * (baseR * 0.74), Math.sin(a) * (baseR * 0.74)); ctx.stroke();
    }
    ctx.restore();

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a3);
    ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 0, baseR * 0.48, 0, Math.PI * 1.3); ctx.stroke();
    ctx.restore();

    ctx.save(); ctx.translate(cx, cy);
    var lockScale = Math.min(1, baseR / 150);
    ctx.scale(lockScale, lockScale);
    ctx.beginPath(); ctx.arc(0, -10, 14, Math.PI, 0);
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#6366f1'; ctx.shadowBlur = 10; ctx.shadowColor = '#6366f1';
    ctx.fillRect(-16, -4, 32, 26); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(0, 5, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#0f172a'; ctx.fill(); ctx.fillRect(-1.5, 6, 3, 7);
    ctx.restore();
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'fiber-optic':
    case 'LinkingNet':
    case 'Launcher':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#04020a;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var fibers = [
    { p0: { x: -0.1, y: 0.2 }, p1: { x: 0.3, y: 0.1 }, p2: { x: 0.7, y: 0.4 }, p3: { x: 1.1, y: 0.35 }, col: '#00f0ff' },
    { p0: { x: -0.1, y: 0.45 }, p1: { x: 0.4, y: 0.6 }, p2: { x: 0.6, y: 0.3 }, p3: { x: 1.1, y: 0.55 }, col: '#00ff88' },
    { p0: { x: -0.1, y: 0.7 }, p1: { x: 0.2, y: 0.85 }, p2: { x: 0.8, y: 0.75 }, p3: { x: 1.1, y: 0.85 }, col: '#c084fc' },
    { p0: { x: -0.1, y: 0.85 }, p1: { x: 0.5, y: 0.7 }, p2: { x: 0.7, y: 0.95 }, p3: { x: 1.1, y: 0.7 }, col: '#00f0ff' }
  ];
  var photons = [];
  for (var i = 0; i < 18; i++) {
    photons.push({ fiberIdx: Math.floor(Math.random() * fibers.length), t: Math.random(), speed: (Math.random() * 0.008 + 0.006) * spdM });
  }
  var sparks = [];
  function getBezierPt(p0, p1, p2, p3, t, w, h) {
    var cx0 = p0.x * w; var cy0 = p0.y * h;
    var cx1 = p1.x * w; var cy1 = p1.y * h;
    var cx2 = p2.x * w; var cy2 = p2.y * h;
    var cx3 = p3.x * w; var cy3 = p3.y * h;
    var mt = 1 - t;
    return {
      x: mt*mt*mt*cx0 + 3*mt*mt*t*cx1 + 3*mt*t*t*cx2 + t*t*t*cx3,
      y: mt*mt*mt*cy0 + 3*mt*mt*t*cy1 + 3*mt*t*t*cy2 + t*t*t*cy3
    };
  }
  function draw() {
    ctx.fillStyle = 'rgba(4, 2, 10, 0.25)'; ctx.fillRect(0, 0, c.width, c.height);
    fibers.forEach(function(f) {
      ctx.beginPath();
      ctx.moveTo(f.p0.x * c.width, f.p0.y * c.height);
      ctx.bezierCurveTo(f.p1.x * c.width, f.p1.y * c.height, f.p2.x * c.width, f.p2.y * c.height, f.p3.x * c.width, f.p3.y * c.height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'; ctx.lineWidth = 2.5; ctx.stroke();
    });
    photons.forEach(function(pt) {
      pt.t += pt.speed;
      if (pt.t >= 1) {
        pt.t = 0; var fb = fibers[pt.fiberIdx];
        for (var s = 0; s < 5; s++) sparks.push({ x: c.width, y: fb.p3.y * c.height, vx: Math.random() * 4 + 2, vy: (Math.random() - 0.5) * 4, life: 1, col: fb.col });
      }
      var fb = fibers[pt.fiberIdx];
      var pos = getBezierPt(fb.p0, fb.p1, fb.p2, fb.p3, pt.t, c.width, c.height);
      var trailPos = getBezierPt(fb.p0, fb.p1, fb.p2, fb.p3, Math.max(0, pt.t - 0.04), c.width, c.height);
      ctx.beginPath(); ctx.moveTo(trailPos.x, trailPos.y); ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = fb.col; ctx.lineWidth = 3.5; ctx.shadowBlur = 14; ctx.shadowColor = fb.col; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    });
    for (var i = sparks.length - 1; i >= 0; i--) {
      var sp = sparks[i]; sp.x += sp.vx; sp.y += sp.vy; sp.life -= 0.04;
      if (sp.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 1.5 * sp.life, 0, Math.PI * 2); ctx.fillStyle = sp.col; ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'synthwave-arcade':
    case 'UserKeys':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#090114;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var gridOffset = 0;
  var stars = [];
  for (var i = 0; i < 40; i++) stars.push({ x: Math.random() * (c.width || 360), y: Math.random() * ((c.height || 640) * 0.5), r: Math.random() * 1.5 + 0.5 });
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); gridOffset = (gridOffset + 2 * spdM) % 36;
    var hy = c.height * 0.54; var cx = c.width / 2;
    stars.forEach(function(st) { ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fillStyle = '#fdf4ff'; ctx.fill(); });
    var sunR = Math.min(c.width * 0.24, c.height * 0.15, 110);
    var sunY = hy - sunR * 0.15;
    var sunGrad = ctx.createLinearGradient(cx, sunY - sunR, cx, sunY + sunR);
    sunGrad.addColorStop(0, '#fde047'); sunGrad.addColorStop(0.5, '#f43f5e'); sunGrad.addColorStop(1, '#8b5cf6');
    ctx.save(); ctx.beginPath(); ctx.arc(cx, sunY, sunR, 0, Math.PI * 2); ctx.fillStyle = sunGrad;
    ctx.shadowBlur = 25; ctx.shadowColor = '#f43f5e'; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#090114';
    var numSlices = 6;
    for (var i = 0; i < numSlices; i++) {
      var sliceY = sunY + (i * (sunR * 1.4 / numSlices)) + 2;
      var sliceH = (i + 1) * (sunR * 0.024);
      ctx.fillRect(cx - sunR - 10, sliceY, (sunR + 10) * 2, sliceH);
    }
    ctx.restore();

    ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(c.width * 0.15, hy - 45); ctx.lineTo(c.width * 0.3, hy);
    ctx.lineTo(c.width * 0.7, hy); ctx.lineTo(c.width * 0.85, hy - 55); ctx.lineTo(c.width, hy);
    ctx.lineTo(c.width, c.height); ctx.lineTo(0, c.height); ctx.closePath();
    ctx.fillStyle = '#06010d'; ctx.fill(); ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)'; ctx.lineWidth = 1;
    var stepX = Math.max(34, Math.floor(c.width * 0.09));
    for (var x = -c.width * 0.4; x <= c.width * 1.4; x += stepX) { ctx.beginPath(); ctx.moveTo(cx, hy); ctx.lineTo(x, c.height); ctx.stroke(); }
    for (var y = hy + gridOffset; y < c.height; y += 24) {
      var alpha = (y - hy) / (c.height - hy); ctx.strokeStyle = 'rgba(168, 85, 247, ' + (alpha * 0.7) + ')';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'barrio-sunset':
    case 'WifiElBarrio':
    case 'Wifi El Barrio':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#0c0508;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var bokehs = []; var cols = ['rgba(234, 88, 12, 0.25)', 'rgba(249, 115, 22, 0.2)', 'rgba(225, 29, 72, 0.2)', 'rgba(217, 119, 6, 0.25)'];
  for (var i = 0; i < 28; i++) {
    bokehs.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: Math.random() * 32 + 14, vy: -(Math.random() * 0.5 + 0.2) * spdM, vx: (Math.random() - 0.5) * 0.3 * spdM, col: cols[Math.floor(Math.random() * 4)], sides: Math.random() > 0.4 ? 7 : 0 });
  }
  var leakT = 0;
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); leakT += 0.015 * spdM;
    var leakX = c.width * (0.3 + Math.sin(leakT) * 0.2);
    var leakGrad = ctx.createRadialGradient(leakX, 0, 40, leakX, c.height * 0.6, c.width * 0.9);
    leakGrad.addColorStop(0, 'rgba(249, 115, 22, 0.18)'); leakGrad.addColorStop(0.5, 'rgba(225, 29, 72, 0.08)'); leakGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leakGrad; ctx.fillRect(0, 0, c.width, c.height);
    bokehs.forEach(function(b) {
      b.y += b.vy; b.x += b.vx;
      if (b.y < -50) { b.y = c.height + 50; b.x = Math.random() * c.width; }
      if (b.x < -50) b.x = c.width + 50; if (b.x > c.width + 50) b.x = -50;
      ctx.save(); ctx.translate(b.x, b.y); ctx.beginPath();
      if (b.sides > 0) {
        for (var i = 0; i < b.sides; i++) {
          var a = (i * Math.PI * 2) / b.sides; var px = Math.cos(a) * b.r; var py = Math.sin(a) * b.r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else {
        ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = b.col; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    });
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'community-bubbles':
    case 'WiFi_Community':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#020814;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var sBubbles = [];
  for (var i = 0; i < 20; i++) {
    sBubbles.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: Math.random() * 20 + 10, vx: (Math.random() - 0.5) * 1.2 * spdM, vy: -(Math.random() * 0.8 + 0.3) * spdM, wobble: Math.random() * Math.PI * 2 });
  }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    var maxDist = Math.min(130, c.width * 0.32);
    for (var i = 0; i < sBubbles.length; i++) {
      for (var j = i + 1; j < sBubbles.length; j++) {
        var b1 = sBubbles[i]; var b2 = sBubbles[j]; var dist = Math.hypot(b1.x - b2.x, b1.y - b2.y);
        if (dist < maxDist) {
          ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y);
          ctx.strokeStyle = 'rgba(56, 189, 248, ' + ((1 - dist / maxDist) * 0.35) + ')'; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }
    sBubbles.forEach(function(b) {
      b.x += b.vx; b.y += b.vy; b.wobble += 0.03 * spdM;
      if (b.y < -40) { b.y = c.height + 40; b.x = Math.random() * c.width; }
      if (b.x < -30 || b.x > c.width + 30) b.vx *= -1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      var sheen = ctx.createLinearGradient(b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r);
      sheen.addColorStop(0, 'rgba(236, 72, 153, 0.15)'); sheen.addColorStop(0.5, 'rgba(6, 182, 212, 0.12)'); sheen.addColorStop(1, 'rgba(234, 179, 8, 0.15)');
      ctx.fillStyle = sheen; ctx.fill();
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'workspace-ribbons':
    case 'workspace':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#04070d;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var t = 0;
  function draw() {
    ctx.fillStyle = 'rgba(4, 7, 13, 0.25)'; ctx.fillRect(0, 0, c.width, c.height); t += 0.015 * spdM;
    var maxAmp = Math.min(65, c.height * 0.1);
    var ribbons = [
      { cy: c.height * 0.35, amp: maxAmp, freq: 0.003, col1: '#0d9488', col2: '#2563eb', thick: 35 },
      { cy: c.height * 0.55, amp: maxAmp * 1.2, freq: 0.0025, col1: '#2563eb', col2: '#6366f1', thick: 45 },
      { cy: c.height * 0.75, amp: maxAmp * 0.85, freq: 0.0035, col1: '#0284c7', col2: '#0d9488', thick: 30 }
    ];
    ribbons.forEach(function(rb, idx) {
      ctx.beginPath();
      for (var x = 0; x <= c.width; x += 15) {
        var y = rb.cy + Math.sin(x * rb.freq + t + idx * 1.2) * rb.amp + Math.cos(x * 0.001 - t * 0.8) * 25;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (var x = c.width; x >= 0; x -= 15) {
        var y = rb.cy + Math.sin(x * rb.freq + t + idx * 1.2) * rb.amp + Math.cos(x * 0.001 - t * 0.8) * 25 + rb.thick;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      var rGrad = ctx.createLinearGradient(0, rb.cy - rb.amp, c.width, rb.cy + rb.amp);
      rGrad.addColorStop(0, rb.col1); rGrad.addColorStop(1, rb.col2);
      ctx.fillStyle = rGrad; ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = rb.col1; ctx.lineWidth = 1.2; ctx.stroke();
    });
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'sunset-glass':
    case 'Window-orange-login':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#0d0502;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var t = 0;
  var fizz = [];
  for (var i = 0; i < 28; i++) fizz.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: Math.random() * 2 + 0.8, vy: -(Math.random() * 0.8 + 0.4) * spdM });
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); t += 0.018 * spdM;
    var numCaustics = 5;
    for (var k = 0; k < numCaustics; k++) {
      var cx = (c.width / 2) + Math.sin(t * 0.7 + k * 1.3) * (c.width * 0.35);
      var cy = (c.height / 2) + Math.cos(t * 0.5 + k * 1.1) * (c.height * 0.3);
      var r = Math.min(c.width, c.height) * (0.32 + k * 0.06);
      var grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.22)'); grad.addColorStop(0.5, 'rgba(217, 119, 6, 0.12)'); grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.15)'; ctx.lineWidth = 2;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      for (var x = 0; x <= c.width; x += 20) {
        var y = (c.height * 0.5) + Math.sin(x * 0.005 + t * 2 + i) * 50 + Math.cos(x * 0.008 - t) * 30;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    fizz.forEach(function(fz) {
      fz.y += fz.vy; if (fz.y < -10) { fz.y = c.height + 10; fz.x = Math.random() * c.width; }
      ctx.beginPath(); ctx.arc(fz.x, fz.y, fz.r, 0, Math.PI * 2); ctx.fillStyle = '#fbbf24'; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'nougat-fluid':
    case 'Nougat':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#020b06;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var blobColors = ['#34d399', '#22d3ee', '#a78bfa', '#fb7185'];
  var blobs = [];
  for (var i = 0; i < 10; i++) {
    var br = Math.random() * 25 + 20;
    blobs.push({ x: Math.random() * (c.width || 360), y: Math.random() * (c.height || 640), r: br, vx: (Math.random() - 0.5) * 1.4 * spdM, vy: (Math.random() - 0.5) * 1.4 * spdM, col: blobColors[i % 4] });
  }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    blobs.forEach(function(b) {
      b.x += b.vx; b.y += b.vy;
      if (b.x < b.r || b.x > c.width - b.r) b.vx *= -1;
      if (b.y < b.r || b.y > c.height - b.r) b.vy *= -1;
    });
    for (var i = 0; i < blobs.length; i++) {
      for (var j = i + 1; j < blobs.length; j++) {
        var b1 = blobs[i]; var b2 = blobs[j]; var dist = Math.hypot(b1.x - b2.x, b1.y - b2.y);
        var maxDist = b1.r + b2.r + Math.min(50, c.width * 0.12);
        if (dist < maxDist) {
          var midX = (b1.x + b2.x) / 2; var midY = (b1.y + b2.y) / 2;
          var bridgeR = ((maxDist - dist) / maxDist) * 20;
          ctx.beginPath(); ctx.arc(midX, midY, bridgeR, 0, Math.PI * 2);
          ctx.fillStyle = b1.col; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
        }
      }
    }
    blobs.forEach(function(b) {
      var grad = ctx.createRadialGradient(b.x, b.y, b.r * 0.1, b.x, b.y, b.r);
      grad.addColorStop(0, b.col); grad.addColorStop(0.8, b.col); grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'prisma-holo':
    case 'Random':
      bgHtml = `<canvas id="mg-fx-niche" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#06020c;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-niche', `
  var spdM = ${spdMult};
  var prismAngle = 0;
  var rainbowColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); prismAngle += 0.015 * spdM;
    var cx = c.width / 2; var cy = c.height / 2;
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, cy - 80); ctx.lineTo(cx, cy);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.shadowBlur = 15; ctx.shadowColor = '#ffffff'; ctx.stroke(); ctx.shadowBlur = 0; ctx.restore();
    ctx.save();
    if (ctx.globalCompositeOperation) ctx.globalCompositeOperation = 'lighter';
    rainbowColors.forEach(function(col, idx) {
      var fanAngle = 0.15 + (idx * 0.065) + Math.sin(prismAngle) * 0.05;
      var reach = (c.width + c.height) * 0.8;
      var endX = cx + Math.cos(fanAngle) * reach; var endY = cy + Math.sin(fanAngle) * reach;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(endX, endY);
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.shadowBlur = 12; ctx.shadowColor = col; ctx.stroke();
    });
    ctx.restore();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(prismAngle);
    var pSize = Math.min(50, c.width * 0.12); ctx.beginPath();
    for (var i = 0; i < 3; i++) {
      var a = (i * Math.PI * 2) / 3 - Math.PI / 2; var px = Math.cos(a) * pSize; var py = Math.sin(a) * pSize;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    for (var i = 0; i < 3; i++) {
      var a = (i * Math.PI * 2) / 3 - Math.PI / 2; var px = Math.cos(a) * pSize; var py = Math.sin(a) * pSize;
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = rainbowColors[i * 2]; ctx.shadowBlur = 8; ctx.shadowColor = '#ffffff'; ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'aurora':
      bgHtml = `<canvas id="mg-fx-aurora-canvas" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#030712;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-aurora-canvas', `
  var spdM = ${spdMult};
  var t = 0;
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    t += 0.012 * spdM;
    var numWaves = 4;
    for (var w = 0; w < numWaves; w++) {
      var grad = ctx.createLinearGradient(0, c.height * 0.1, c.width, c.height * 0.85);
      if (w === 0) { grad.addColorStop(0, 'rgba(16, 185, 129, 0)'); grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.28)'); grad.addColorStop(1, 'rgba(6, 182, 212, 0)'); }
      else if (w === 1) { grad.addColorStop(0, 'rgba(6, 182, 212, 0)'); grad.addColorStop(0.5, 'rgba(59, 130, 246, 0.22)'); grad.addColorStop(1, 'rgba(147, 51, 234, 0)'); }
      else if (w === 2) { grad.addColorStop(0, 'rgba(168, 85, 247, 0)'); grad.addColorStop(0.5, 'rgba(236, 72, 153, 0.2)'); grad.addColorStop(1, 'rgba(16, 185, 129, 0)'); }
      else { grad.addColorStop(0, 'rgba(52, 211, 153, 0)'); grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.18)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); }
      ctx.fillStyle = grad;
      ctx.beginPath();
      var yBase = c.height * (0.2 + w * 0.18);
      ctx.moveTo(0, c.height);
      for (var x = 0; x <= c.width; x += 12) {
        var y = yBase + Math.sin(x * 0.005 + t * 1.2 + w * 1.5) * (45 + w * 15) + Math.cos(x * 0.009 - t * 0.8) * 25;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(c.width, c.height);
      ctx.closePath();
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'matrix':
      bgHtml = `<canvas id="mg-fx-canvas-matrix" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#020603;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-canvas-matrix', `
  var spdM = ${spdMult};
  var fontSize = 14;
  var cols = Math.floor((c.width || 360) / fontSize) + 1;
  var drops = [];
  for (var i = 0; i < cols; i++) drops[i] = Math.floor(Math.random() * -35);
  var chars = '01010101MIKROGESTORWIFI24GHZ5GHZ#$@%*+-=';
  var lastTime = 0;
  function draw(timestamp) {
    if (!lastTime || timestamp - lastTime >= 40 / spdM) {
      lastTime = timestamp;
      ctx.fillStyle = 'rgba(2, 6, 3, 0.14)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = 'bold 12px monospace';
      var curCols = Math.floor(c.width / fontSize) + 1;
      while (drops.length < curCols) drops.push(0);
      for (var i = 0; i < curCols; i++) {
        var text = chars[Math.floor(Math.random() * chars.length)];
        var x = i * fontSize;
        var y = (drops[i] || 0) * fontSize;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, x, y);
        ctx.fillStyle = '${green || '#10b981'}';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '${green || '#10b981'}';
        ctx.fillText(text, x, y - fontSize);
        ctx.shadowBlur = 0;
        if (y > c.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
      `);
      break;

    case 'cyber-grid':
      bgHtml = `<canvas id="mg-fx-cybergrid-canvas" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#05020f;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-cybergrid-canvas', `
  var spdM = ${spdMult};
  var offset = 0;
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    var horizon = c.height * 0.48;
    var skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, '#0f051d'); skyGrad.addColorStop(1, '#1e0836');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, c.width, horizon);
    offset = (offset + 2.2 * spdM) % 32;
    for (var y = horizon; y < c.height; y += Math.pow((y - horizon) / 14, 1.4) + 6) {
      var currentY = y + offset * ((y - horizon) / (c.height - horizon));
      if (currentY > c.height) continue;
      var alpha = (currentY - horizon) / (c.height - horizon);
      ctx.strokeStyle = 'rgba(217, 70, 239, ' + (alpha * 0.75) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, currentY); ctx.lineTo(c.width, currentY); ctx.stroke();
    }
    var cx = c.width / 2;
    var spreadX = Math.max(36, Math.floor(c.width / 14));
    for (var x = -c.width * 0.8; x <= c.width * 1.8; x += spreadX) {
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, horizon); ctx.lineTo(x, c.height); ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'floating-orbs':
      bgHtml = `<canvas id="mg-fx-orbs-canvas" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#040714;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-orbs-canvas', `
  var spdM = ${spdMult};
  var orbs = [
    { xP: 0.3, yP: 0.3, rP: 0.28, vx: 0.7, vy: 0.5, col: '#3b82f6' },
    { xP: 0.7, yP: 0.7, rP: 0.32, vx: -0.6, vy: -0.5, col: '#8b5cf6' },
    { xP: 0.5, yP: 0.5, rP: 0.24, vx: 0.5, vy: -0.7, col: '#06b6d4' },
    { xP: 0.8, yP: 0.2, rP: 0.22, vx: -0.5, vy: 0.6, col: '#ec4899' }
  ];
  orbs.forEach(function(o) {
    o.x = o.xP * (c.width || 360);
    o.y = o.yP * (c.height || 640);
  });
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    var baseR = Math.min(c.width, c.height);
    orbs.forEach(function(o) {
      var r = baseR * o.rP;
      o.x += o.vx * spdM;
      o.y += o.vy * spdM;
      if (o.x < -20 || o.x > c.width + 20) o.vx *= -1;
      if (o.y < -20 || o.y > c.height + 20) o.vy *= -1;
      var grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
      grad.addColorStop(0, o.col);
      grad.addColorStop(0.6, o.col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'fireflies':
      bgHtml = `<canvas id="mg-fx-fireflies-canvas" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#05070a;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-fireflies-canvas', `
  var spdM = ${spdMult};
  var flies = [];
  for (var i = 0; i < 35; i++) {
    flies.push({
      x: Math.random() * (c.width || 360),
      y: Math.random() * (c.height || 640),
      r: Math.random() * 2.5 + 1.2,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      glowPhase: Math.random() * Math.PI * 2,
      glowSpeed: Math.random() * 0.04 + 0.02,
      col: Math.random() > 0.3 ? '#facc15' : '#4ade80'
    });
  }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    flies.forEach(function(f) {
      f.x += f.vx * spdM + Math.sin(f.glowPhase) * 0.4;
      f.y += f.vy * spdM + Math.cos(f.glowPhase) * 0.4;
      f.glowPhase += f.glowSpeed * spdM;
      if (f.x < 0) f.x = c.width; if (f.x > c.width) f.x = 0;
      if (f.y < 0) f.y = c.height; if (f.y > c.height) f.y = 0;
      var brightness = Math.sin(f.glowPhase) * 0.5 + 0.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.8 + brightness * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = f.col;
      ctx.shadowBlur = 12 * brightness;
      ctx.shadowColor = f.col;
      ctx.globalAlpha = 0.2 + brightness * 0.8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'warp-stars':
      bgHtml = `<canvas id="mg-fx-canvas-warp" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#020005;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-canvas-warp', `
  var spdM = ${spdMult};
  var stars = [];
  var maxDepth = Math.max(c.width || 360, c.height || 640);
  for (var i = 0; i < 80; i++) {
    stars.push({ x: (Math.random() - 0.5) * (c.width || 360) * 1.5, y: (Math.random() - 0.5) * (c.height || 640) * 1.5, z: Math.random() * maxDepth });
  }
  function draw() {
    ctx.fillStyle = 'rgba(2, 0, 5, 0.3)';
    ctx.fillRect(0, 0, c.width, c.height);
    var cx = c.width / 2; var cy = c.height / 2;
    var starSpeed = 8 * spdM;
    var maxD = Math.max(c.width, c.height);
    stars.forEach(function(s) {
      s.z -= starSpeed;
      if (s.z <= 0) {
        s.z = maxD;
        s.x = (Math.random() - 0.5) * c.width * 1.5;
        s.y = (Math.random() - 0.5) * c.height * 1.5;
      }
      var k = 140 / s.z;
      var px = s.x * k + cx;
      var py = s.y * k + cy;
      var prevK = 140 / (s.z + starSpeed * 2.5);
      var prevX = s.x * prevK + cx;
      var prevY = s.y * prevK + cy;
      if (px >= 0 && px <= c.width && py >= 0 && py <= c.height) {
        var size = Math.max(0.8, (1 - s.z / maxD) * 2.8);
        ctx.strokeStyle = 'rgba(167, 139, 250, ' + Math.min(1, (1 - s.z / maxD) * 1.5) + ')';
        ctx.lineWidth = size;
        ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(px, py); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, size * 0.6, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      }
    });
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'wave-mesh':
      bgHtml = `<canvas id="mg-fx-canvas-waves" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#030611;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-canvas-waves', `
  var spdM = ${spdMult};
  var t = 0;
  var waveCols = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  function draw() {
    ctx.fillStyle = 'rgba(3, 6, 17, 0.2)';
    ctx.fillRect(0, 0, c.width, c.height);
    t += 0.02 * spdM;
    for (var w = 0; w < 4; w++) {
      ctx.beginPath();
      var yBase = c.height * (0.45 + w * 0.12);
      for (var x = 0; x <= c.width; x += 14) {
        var y = yBase + Math.sin(x * 0.008 + t * (1 + w * 0.3) + w * 1.2) * (35 + w * 8) + Math.cos(x * 0.004 - t * 0.6) * 18;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = waveCols[w];
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = waveCols[w];
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'fap-adventista':
    case 'fap':
    case 'edu-adventista':
      bgHtml = `<div id="mg-fx-fap-bg" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background: linear-gradient(135deg, #002B49 0%, #001726 100%);"></div>`;
      cssEffects = `
    .edu-logo {
      width: 90px;
      height: auto;
      margin: 0 auto 12px;
      display: block;
      filter: drop-shadow(0px 0px 8px rgba(255, 255, 255, 0.25));
    }

    .anim-path {
      fill: transparent;
      stroke: #ffffff;
      stroke-width: 60;
      stroke-miterlimit: 22.9256;
      stroke-dasharray: var(--length, 12000);
      stroke-dashoffset: var(--length, 12000);
      animation:
        draw 2.5s ease-in-out forwards,
        fillIn 1.5s ease-in-out 2.5s forwards;
    }

    @keyframes draw {
      to { stroke-dashoffset: 0; }
    }

    @keyframes fillIn {
      from {
        fill: transparent;
        stroke-width: 60;
      }
      to {
        fill: #ffffff;
        stroke-width: 18.11;
      }
    }

    .fap-campus-tag {
      display: inline-block;
      margin-top: 10px;
      font-size: 11px;
      font-weight: 700;
      color: #001726;
      background: #F39200;
      padding: 4px 12px;
      border-radius: 20px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
`;
      jsEffects = `
(function() {
  function initFapLogo() {
    var logoWrap = document.getElementById('mg-live-brand-container') || document.querySelector('.logo-wrap') || document.querySelector('#box') || document.querySelector('.login-card') || document.body;
    if (logoWrap) {
      var existingFap = document.getElementById('mg-fap-logo-svg');
      if (!existingFap) {
        var svgDiv = document.createElement('div');
        svgDiv.id = 'mg-fap-logo-svg';
        svgDiv.style.cssText = 'text-align: center; margin-bottom: 12px; width: 100%;';
        svgDiv.innerHTML = '<svg class="edu-logo" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 8630.33 7900.02" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"><g id="Camada_x0020_1"><g id="_2433694493040"><path class="anim-path" d="M1200.75 4269.16l291.33 -185.17c680.24,-374.63 2195.5,-620.36 2950.01,-815.23 576.9,-149 1943.36,-450.15 2383.52,-816.63 256.49,-213.56 348.01,-348.88 291.88,-779.31 -98.16,91.18 -273.76,448.26 -630.06,547.84 -64.49,-74.19 -90.42,-171.61 -127.27,-267.34 -37.87,-98.39 -68.87,-177.21 -107.73,-276.01 -74.02,-188.26 -135.66,-372.86 -208.65,-560.04 -143.82,-368.83 -325.98,-764.88 -423.71,-1108.2l-1128.95 0c19.05,307.41 593.55,2288.42 654.63,2689.74l-1746.56 399.77 751.59 -3089.51 -1128.95 0 -1379.05 3584.94c-56.55,102.94 12.49,21.69 -91.08,101.52 -49.15,37.89 -60.68,39.98 -107.86,80.87 -110.5,95.76 -291.52,261.42 -243.09,492.77z"/><path class="anim-path" d="M5734.65 5050.76c67.34,285.5 561.26,2368.17 632.7,2444.39 89.19,88.35 888.41,145.14 1127.81,183.48 199.6,31.98 380.62,56.53 581.16,90 126.14,21.04 428.57,71.74 543.79,117.5 -17.04,-205.94 -530.44,-1424.96 -640.5,-1706.94l-661.72 -1709.23 -1180.22 447.73c-139.29,45.93 -267.23,61.57 -403.02,133.08z"/><path class="anim-path" d="M300.35 6766.97c564.99,-641.76 893.97,-794.1 1771.48,-1080.4 777.69,-253.73 1501.33,-389.34 2279.44,-607.44 837.44,-234.73 1374.09,-367.68 2223.06,-648.18 499.87,-165.17 1043.82,-352.98 1240.37,-896.12 66.08,-182.59 97,-468.51 3.34,-647.13 -55.16,73.94 -69.2,131.68 -122.03,210.24 -50.26,74.75 -99.66,109.21 -168.99,181.68l-388.68 316.06c-544.27,358.64 -2676.01,852.64 -3305.9,1000.5 -1287.44,302.21 -3708.62,696.76 -3532.09,2170.8z"/><path class="anim-path" d="M715.26 5430.6c336.81,-406.74 1079.92,-645.01 1700.72,-817.04l1503.57 -368.74c676.97,-155.46 1938.08,-453.51 2499.66,-663.34 629.55,-235.23 1270.71,-611.11 1042.92,-1421.86 -233.77,618.64 -867.5,846.25 -1468.01,1031.45 -1069.53,329.84 -4123.43,899.49 -4711.52,1283.76 -300.59,196.41 -718,465.81 -567.33,955.77z"/><path class="anim-path" d="M10.41 7886.51c250.71,-92.8 795.9,-158.54 1098.35,-203.04 255.67,-37.62 1002.94,-101.54 1164.06,-168.56 50.83,-92.49 406.35,-1505.35 417.55,-1675.44 -713.76,245.8 -1801.47,427.71 -2348.94,1210.85 -88.49,126.59 -317.67,699.57 -331.01,836.18z"/></g></g></svg>';
        logoWrap.prepend(svgDiv);
      }
    }

    var paths = document.querySelectorAll('.anim-path');
    paths.forEach(function(path) {
      if (path.getTotalLength) {
        var length = path.getTotalLength();
        path.style.setProperty('--length', length);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFapLogo);
  } else {
    initFapLogo();
  }
})();
`;
      break;

    case 'bubblegum-pop':
    case 'bubblegum':
    case 'bubblegum-hardcore':
      bgHtml = `<canvas id="mg-fx-bubblegum" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#f472b6;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-bubblegum', `
  var spdM = ${spdMult};
  var items = [];
  var colors = ['#ffffff', '#38bdf8', '#4ade80', '#fef08a', '#c084fc', '#fb7185'];
  var shapes = ['circle', 'bubble', 'cross', 'donut', 'square'];
  var count = Math.min(32, Math.max(16, Math.floor((c.width || 360) / 18)));
  for (var i = 0; i < count; i++) {
    items.push({
      x: Math.random() * (c.width || 360),
      y: Math.random() * (c.height || 640),
      vx: (Math.random() - 0.5) * 0.9 * spdM,
      vy: (-Math.random() * 0.8 - 0.3) * spdM,
      size: Math.random() * 22 + 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.03 * spdM
    });
  }
  function draw() {
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(0, 0, c.width, c.height);
    var dotGap = 36;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (var px = 18; px < c.width; px += dotGap) {
      for (var py = 18; py < c.height; py += dotGap) {
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      it.x += it.vx;
      it.y += it.vy;
      it.rot += it.vrot;
      if (it.y < -40) { it.y = c.height + 30; it.x = Math.random() * c.width; }
      if (it.x < -40) it.x = c.width + 30;
      if (it.x > c.width + 40) it.x = -30;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      ctx.fillStyle = it.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      if (it.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, it.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-it.size * 0.35, -it.size * 0.35, it.size * 0.28, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.shape === 'bubble') {
        ctx.beginPath();
        ctx.arc(0, 0, it.size * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (it.shape === 'donut') {
        ctx.beginPath();
        ctx.arc(0, 0, it.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(0, 0, it.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (it.shape === 'cross') {
        var s = it.size * 0.8;
        var t = s * 0.35;
        ctx.beginPath();
        ctx.rect(-t, -s, t * 2, s * 2);
        ctx.rect(-s, -t, s * 2, t * 2);
        ctx.fill();
        ctx.stroke();
      } else if (it.shape === 'square') {
        var half = it.size * 0.7;
        ctx.beginPath();
        ctx.rect(-half, -half, half * 2, half * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;

    case 'particles':
    default:
      if (bgEffect === 'none') {
        return { html: '', css: '', js: '' };
      }
      bgHtml = `<canvas id="mg-fx-canvas-particles" class="mg-fx-canvas" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1; pointer-events:none; background:#080914;"></canvas>`;
      jsEffects = canvasBootstrap('mg-fx-canvas-particles', `
  var spdM = ${spdMult};
  var count = Math.min(45, Math.max(20, Math.floor((c.width || 360) / 16)));
  var particles = [];
  for (var i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * (c.width || 360),
      y: Math.random() * (c.height || 640),
      vx: (Math.random() - 0.5) * 1.6 * spdM,
      vy: (Math.random() - 0.5) * 1.6 * spdM,
      radius: Math.random() * 2 + 1
    });
  }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i]; p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > c.width) p.vx *= -1; if (p.y < 0 || p.y > c.height) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = '${brand}'; ctx.fill();
      for (var j = i + 1; j < particles.length; j++) {
        var p2 = particles[j]; var dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        var maxD = Math.min(100, c.width * 0.28);
        if (dist < maxD) {
          ctx.beginPath(); ctx.strokeStyle = '${brand}'; ctx.globalAlpha = (1 - dist / maxD) * 0.6; ctx.lineWidth = 0.8;
          ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); ctx.globalAlpha = 1;
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
      `);
      break;
  }

  cssEffects += `
.mg-fx-canvas {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 1 !important;
  pointer-events: none !important;
}
`;

  return { html: bgHtml, css: cssEffects, js: jsEffects };
}
