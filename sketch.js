let font, pg;
let currentTxt = "murmuration";
let fontSize = 115;
let focalX, focalY;
let particles = [];
let animating = false;

const DENSITY    = 20000;
const OFFSET     = 100;

const T_MAX_SPEED     = 1.4;
const T_MAX_FORCE     = 0.045;
const T_ALI_W         = 1.5;
const T_COH_W         = 0.25;
const T_SEP_W         = 1.0;
const T_HOME_FREE_R   = 14;
const T_HOME_K_SOFT   = 0.001;
const T_HOME_K_HARD   = 0.09;
const T_HOME_HARD_CAP = T_MAX_FORCE * 6;
const T_GLOBAL_F      = 0.009;

const S_MAX_SPEED  = 1.8;
const S_MAX_FORCE  = 0.055;
const S_ALI_W      = 1.6;
const S_COH_W      = 0.6;
const S_SEP_W      = 1.1;
const S_HOME_K     = 0.0012;
const S_HOME_K_MAX = S_MAX_FORCE * 1.8;


const PERCEPTION = 40;
const SEP_RADIUS = 10;
const PSQR       = PERCEPTION * PERCEPTION;
const SSQR       = SEP_RADIUS * SEP_RADIUS;

let globalAngle, globalTarget, globalTurnSpeed;

function preload() {
  font = loadFont("ALTMariaClara-Regular.otf");
}

function setup() {
  let landing = document.getElementById('landing');
  let cnv = createCanvas(landing.offsetWidth, landing.offsetHeight);
  cnv.parent('landing');
  angleMode(DEGREES);

  globalAngle     = random(360);
  globalTarget    = random(360);
  globalTurnSpeed = random(0.3, 0.8);

  rebuildParticles();
  noLoop();
}

function mousePressed() {
  let landing = document.getElementById('landing');
  let rect = landing.getBoundingClientRect();
  let mx = mouseX, my = mouseY;
  if (mx < 0 || mx > rect.width || my < 0 || my > rect.height) return;

  rebuildParticles();
}

function redrawStatic() {
  background(0);
  strokeWeight(1);
  for (let p of particles) {
    let x2 = p.x + cos(p.angle) * p.len;
    let y2 = p.y + sin(p.angle) * p.len;
    stroke(255, 238, 73, 255 * p.fade);
    line(p.x, p.y, x2, y2);
  }
}


function renderTextToGraphics(lines, pg) {
  pg.fill(255);
  pg.noStroke();
  pg.textFont(font);
  pg.textSize(fontSize);

  let lineHeight = fontSize * 1.25;
  let maxW = 0;
  let lineH = 0;
  let lineBounds = [];
  for (let line of lines) {
    let b = font.textBounds(line, 0, 0, fontSize);
    lineBounds.push(b);
    if (b.w > maxW) maxW = b.w;
    if (b.h > lineH) lineH = b.h;
  }

  let totalH = lineH + lineHeight * (lines.length - 1);

  let blockX = width  / 2 - maxW  / 2;
  let blockY = height / 2 - totalH / 2;

  for (let i = 0; i < lines.length; i++) {
    let lx = width / 2 - lineBounds[i].w / 2;
    let ly = blockY + lineH + lineHeight * i;
    pg.text(lines[i], lx, ly);
  }

  return {
    x: blockX,
    y: blockY,
    w: maxW,
    h: totalH,
    lineH
  };
}

function rebuildParticles() {
  particles = [];
  clear();
  background(0);

  let txt = currentTxt;

  let lines = txt.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return;

  pg = createGraphics(width, height);
  pg.pixelDensity(1);
  pg.clear();

  let bounds = renderTextToGraphics(lines, pg);
  pg.loadPixels();

  let tx = bounds.x;
  let ty = bounds.y;

  focalX = random(tx + bounds.w * 0.2, tx + bounds.w * 0.8);
  focalY = random(ty + bounds.h * 0.1, ty + bounds.h * 0.9);
  for (let r = 0; r < 60; r++) {
    let fi = (floor(focalX) + floor(focalY) * width) * 4;
    if (pg.pixels[fi] > 10) break;
    focalX = random(tx + bounds.w * 0.1, tx + bounds.w * 0.9);
    focalY = random(ty + bounds.h * 0.05, ty + bounds.h * 0.95);
  }

  let charCount   = max(txt.replace(/\n/g, '').length, 1);
  let focalBias   = map(charCount, 1, 28, 0.18, 1.0, true);
  let coreSpread  = bounds.w * lerp(0.18, 0.10, focalBias);
  let midSpread   = bounds.w * lerp(0.42, 0.30, focalBias);
  let maxDist     = sqrt(bounds.w * bounds.w + bounds.h * bounds.h);
  let maxOffset   = bounds.h * 0.3;
  let attempts    = DENSITY;
  let offsetTight = OFFSET / 100;
  let lenMin      = 3;
  let lenMax      = 9;
  let coreChance  = lerp(0.12, 0.40, focalBias);
  let midChance   = lerp(0.30, 0.80, focalBias);

  for (let i = 0; i < attempts; i++) {
    let sx, sy;
    let r = random();
    if      (r < coreChance) { sx = focalX + randomGaussian(0, coreSpread); sy = focalY + randomGaussian(0, coreSpread * 0.7); }
    else if (r < midChance)  { sx = focalX + randomGaussian(0, midSpread);  sy = focalY + randomGaussian(0, midSpread  * 0.7); }
    else                     { sx = random(tx, tx + bounds.w); sy = random(ty, ty + bounds.h); }

    let ix = floor(sx), iy = floor(sy);
    if (ix < 0 || ix >= width || iy < 0 || iy >= height) continue;
    if (pg.pixels[(ix + iy * width) * 4] <= 10) continue;

    let nd          = dist(sx, sy, focalX, focalY) / maxDist;
    let offsetSigma = maxOffset * offsetTight * pow(nd, 1.0);
    let px          = sx + randomGaussian(0, offsetSigma);
    let py          = sy + randomGaussian(0, offsetSigma * 0.8);

    let initAngle;
    if (nd < 0.08) {
      initAngle = random(360);
    } else {
      let radial = atan2(sy - focalY, sx - focalX);
      let jitter = map(nd, 0.08, 1.0, 60, 12);
      initAngle  = radial + random(-jitter, jitter);
    }

    let len    = map(pow(nd, 0.7), 0, 1, lenMin * 0.4, lenMax);
    let fade   = exp(-nd * 2.8) * 0.88 + 0.12;
    let speed0 = random(0.2, 0.6);

    particles.push({
      homeX: px, homeY: py,
      x: px,     y: py,
      vx: cos(initAngle) * speed0,
      vy: sin(initAngle) * speed0,
      nd,
      angle: initAngle,
      baseAngle: initAngle,
      len, fade,
      seed: random(1000)
    });
  }

  pg.remove();

  animating = true;
  loop();
}

function draw() {
  background(0);

  if (!animating) { redrawStatic(); return; }

  if (frameCount % floor(random(200, 480)) === 0) {
    globalTarget    = random(360);
    globalTurnSpeed = random(0.25, 1.0);
  }
  let gda = globalTarget - globalAngle;
  while (gda >  180) gda -= 360;
  while (gda < -180) gda += 360;
  globalAngle += gda * 0.004 * globalTurnSpeed;

  let grid = new Map();
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    let k = floor(p.x / PERCEPTION) + ',' + floor(p.y / PERCEPTION);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }

  strokeWeight(1);

  for (let i = 0; i < particles.length; i++) {
    let p  = particles[i];
    let gx = floor(p.x / PERCEPTION);
    let gy = floor(p.y / PERCEPTION);

    let svx=0,svy=0,sc=0;
    let avx=0,avy=0,ac=0;
    let cohX=0,cohY=0,cc=0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        let cell = grid.get((gx+dx) + ',' + (gy+dy));
        if (!cell) continue;
        for (let j of cell) {
          if (j === i) continue;
          let o   = particles[j];
          let ddx = p.x - o.x, ddy = p.y - o.y;
          let d2  = ddx*ddx + ddy*ddy;
          if (d2 < SSQR && d2 > 0) {
            let d = sqrt(d2); svx += ddx/d; svy += ddy/d; sc++;
          }
          if (d2 < PSQR) {
            avx += o.vx; avy += o.vy; ac++;
            cohX += o.x; cohY += o.y; cc++;
          }
        }
      }
    }

    let ax = 0, ay = 0;

    let CUR_MAX_SPEED = S_MAX_SPEED;
    let CUR_MAX_FORCE = S_MAX_FORCE;
    let CUR_ALI_W     = S_ALI_W;
    let CUR_COH_W     = S_COH_W;
    let CUR_SEP_W     = S_SEP_W;

    if (sc > 0) {
      let sm = sqrt(svx*svx + svy*svy);
      if (sm > 0) { svx /= sm; svy /= sm; }
      let fx = svx*CUR_MAX_SPEED - p.vx, fy = svy*CUR_MAX_SPEED - p.vy;
      let fm = sqrt(fx*fx + fy*fy);
      let cap = CUR_MAX_FORCE * CUR_SEP_W;
      if (fm > cap) { fx = fx/fm*cap; fy = fy/fm*cap; }
      ax += fx; ay += fy;
    }

    if (ac > 0) {
      avx /= ac; avy /= ac;
      let am = sqrt(avx*avx + avy*avy);
      if (am > 0) { avx = avx/am*CUR_MAX_SPEED; avy = avy/am*CUR_MAX_SPEED; }
      let fx = avx - p.vx, fy = avy - p.vy;
      let fm = sqrt(fx*fx + fy*fy);
      let cap = CUR_MAX_FORCE * CUR_ALI_W;
      if (fm > cap) { fx = fx/fm*cap; fy = fy/fm*cap; }
      ax += fx; ay += fy;
    }

    if (cc > 0) {
      let tx2 = cohX/cc - p.x, ty2 = cohY/cc - p.y;
      let cm = sqrt(tx2*tx2 + ty2*ty2);
      if (cm > 0) {
        tx2 = tx2/cm*CUR_MAX_SPEED; ty2 = ty2/cm*CUR_MAX_SPEED;
        let fx = tx2 - p.vx, fy = ty2 - p.vy;
        let fm = sqrt(fx*fx + fy*fy);
        let cap = CUR_MAX_FORCE * CUR_COH_W;
        if (fm > cap) { fx = fx/fm*cap; fy = fy/fm*cap; }
        ax += fx; ay += fy;
      }
    }

    let hdx = p.homeX - p.x, hdy = p.homeY - p.y;
    let hd  = sqrt(hdx*hdx + hdy*hdy);
    if (hd > 0) {
      let hf = min(sqrt(hd) * S_HOME_K * 2.5, S_HOME_K_MAX);
      ax += hdx/hd * hf; ay += hdy/hd * hf;
    }

    let gfactor = 0.018 * (0.5 + p.nd * 1.0);
    ax += cos(globalAngle) * gfactor;
    ay += sin(globalAngle) * gfactor;

    p.vx += ax; p.vy += ay;
    let speed = sqrt(p.vx*p.vx + p.vy*p.vy);
    if (speed > CUR_MAX_SPEED) { p.vx = p.vx/speed*CUR_MAX_SPEED; p.vy = p.vy/speed*CUR_MAX_SPEED; }
    p.vx *= 0.96; p.vy *= 0.96;
    p.x  += p.vx;  p.y  += p.vy;

    if (speed > 0.06) {
      let target = atan2(p.vy, p.vx);
      let da = target - p.angle;
      while (da >  180) da -= 360;
      while (da < -180) da += 360;
      p.angle += da * 0.08;
    }

    let x2 = p.x + cos(p.angle) * p.len;
    let y2 = p.y + sin(p.angle) * p.len;
    stroke(255, 238, 73, 255 * p.fade);
    line(p.x, p.y, x2, y2);
  }
}

function keyPressed() {
  if (key === "s" || key === "S") saveCanvas("murmuration", "png");
}

function windowResized() {
  let landing = document.getElementById('landing');
  resizeCanvas(landing.offsetWidth, landing.offsetHeight);
  rebuildParticles();
}
