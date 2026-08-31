// 스테이지 클리어 - 스톤이 서 있는 곳이 확대되고, 웃으면서 화이팅 합니다.

import { CFG } from '../config.js';
import { G } from '../state.js';
import { Input } from '../input.js';
import { Sound } from '../audio.js';
import { renderField } from '../world.js';
import { drawStone, drawPirodi, drawMom, drawTree, drawHouse, ell } from '../sprites.js';
import { drawFlower } from '../world.js';
import { text, panel, drawHint } from '../ui.js';

export const clearScene = {
  enter(data) {
    this.play = data.play;
    this.stage = data.stage ?? 0;
    this.last = this.stage >= CFG.STAGES.length - 1;
    this.t = 0;
    this.shown = 0;             // 화면에 세어 올라가는 점수
    this.bonusGiven = false;

    const s = this.play.stone;
    s.forceExpr = 'happy';
    s.cheer = 0.0001;
    s.moving = false;
    s.swing = null;

    this.cam = { x: s.x, y: s.y - 12, zoom: 1 };
    Sound.stopBgm();
    Sound.sfx(this.last ? 'win' : 'clear');
  },

  exit() {
    if (this.play && this.play.stone) {
      this.play.stone.forceExpr = null;
      this.play.stone.cheer = 0;
    }
  },

  update(dt) {
    this.t += dt;
    const s = this.play.stone;

    // 확대하면서 스톤에게 다가갑니다
    const k = Math.min(1, dt * 3.2);
    this.cam.zoom += (CFG.CLEAR_ZOOM - this.cam.zoom) * k;
    const hw = G.vw / (2 * this.cam.zoom), hh = G.vh / (2 * this.cam.zoom);
    const tx = Math.max(hw, Math.min(this.play.world.pw - hw, s.x));
    const ty = Math.max(hh, Math.min(this.play.world.ph - hh, s.y - 12));
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;

    // 화이팅 동작
    s.cheer += dt;
    s.walk += dt * 2;
    s.expr = 'happy';

    // 남은 젤리 방울 정리
    for (let i = this.play.particles.length - 1; i >= 0; i--) {
      const p = this.play.particles[i];
      p.life -= dt; p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) this.play.particles.splice(i, 1);
    }
    this.play.scorePops.length = 0;
    this.play.hitFx.length = 0;

    // 클리어 보너스 + 점수 올라가는 연출
    if (!this.bonusGiven && this.t > 0.5) {
      this.bonusGiven = true;
      G.score += CFG.SCORE.stageClear;
    }
    if (this.shown < G.score) {
      this.shown = Math.min(G.score, this.shown + Math.ceil((G.score - this.shown) * dt * 4) + Math.ceil(dt * 300));
    }

    if (this.t > 1.6 && (Input.justPressed('Enter') || Input.justPressed('Space'))) {
      Sound.sfx('select');
      this.shown = G.score;
      if (this.last) G.go('ending', { score: G.score });
      else G.go('play', { stage: this.stage + 1 });     // 다음 스테이지 - 에너지는 100으로 완충
    }
  },

  // 도트 레이어
  draw() {
    const c = G.vctx;

    renderField(c, this.play.world, this.cam, G.vw, G.vh, {
      stone: this.play.stone,
      pirodis: [],
      particles: this.play.particles,
      hitFx: [],
      scorePops: [],
    }, this.t);

    // 화면을 살짝 어둡게 해서 글자가 잘 보이게
    c.fillStyle = 'rgba(8,20,10,0.28)';
    c.fillRect(0, 0, G.vw, G.vh);

    // 반짝이 (축하 느낌)
    for (let i = 0; i < 16; i++) {
      const p = (this.t * 0.6 + i * 0.137) % 1;
      const x = ((i * 97) % G.vw);
      const y = G.vh - p * G.vh;
      c.fillStyle = ['#fff27a', '#ffb3e6', '#a8f06a', '#bdf0ff'][i % 4];
      c.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  },

  // 글자 레이어
  drawUI() {
    const ctx = G.ctx, u = G.scale;

    const a = Math.min(1, this.t / 0.5);
    text(ctx, this.last ? '모든 스테이지 클리어!' : `스테이지 ${this.stage + 1} 클리어!`,
      G.W / 2, G.H * 0.17, 26 * u, '#fff27a', { alpha: a });

    const pw = 260 * u, ph = 58 * u;
    const px = Math.round(G.W / 2 - pw / 2), py = Math.round(G.H * 0.70);
    if (this.t > 0.4) {
      panel(ctx, px, py, pw, ph, { b: Math.max(3, 1.2 * u) });
      text(ctx, '점수', G.W / 2, py + 16 * u, 10 * u, '#cfeecf');
      text(ctx, String(this.shown), G.W / 2, py + 39 * u, 22 * u, '#ffffff');
    }

    if (this.t > 1.6) {
      const blink = 0.4 + 0.6 * ((Math.sin(this.t * 5) + 1) / 2);
      drawHint(ctx, G, this.last ? '엔터를 누르면 처음으로' : '엔터를 누르면 다음 스테이지!', blink);
    }
  },
};

// ---------------------------------------------------------------- 전체 클리어 엔딩

export const endingScene = {
  enter(data) {
    this.t = 0;
    this.score = data.score ?? G.score;
    Sound.bgm('ending');
  },

  update(dt) {
    this.t += dt;
    if (this.t > 0.8 && (Input.justPressed('Enter') || Input.justPressed('Escape'))) {
      Sound.sfx('select');
      G.go('intro');
    }
  },

  // 도트 레이어
  draw() {
    drawCelebration(G.vctx, G.vw, G.vh, this.t);
  },

  // 글자 레이어
  drawUI() {
    const ctx = G.ctx, u = G.scale;

    text(ctx, '축하해요!', G.W / 2, G.H * 0.24, 34 * u, '#fff27a');
    text(ctx, '스톤이 삐로디를 모두 무찔렀어요', G.W / 2, G.H * 0.36, 13 * u, '#ffffff');
    text(ctx, `최종 점수  ${this.score}`, G.W / 2, G.H * 0.50, 22 * u, '#a8f06a');

    if (this.t > 0.8) {
      const blink = 0.4 + 0.6 * ((Math.sin(this.t * 5) + 1) / 2);
      text(ctx, '엔터 또는 ESC · 처음으로', G.W / 2, G.H - 26 * u, 8 * u, '#cfe9d4', { alpha: blink });
    }

    text(ctx, '기획 및 일러스트 KDH · 개발 KJW · ⓒ PEACHSOFT 2026',
      G.W / 2, G.H - 11 * u, 6.5 * u, '#d8e4ff', { alpha: 0.7 });
  },
};

function drawCelebration(c, vw, vh, t) {
  // 잔디밭과 캐릭터를 조금 위로 올렸습니다 (아래쪽 크레딧 문구와 겹치지 않도록)
  const gy = Math.round(vh * 0.62);        // 잔디밭이 시작하는 높이
  const castY = Math.round(vh * 0.82);     // 캐릭터들이 서 있는 높이

  // ---- 밤하늘
  c.fillStyle = '#141f3d'; c.fillRect(0, 0, vw, gy);
  for (let i = 0; i < 5; i++) {            // 위로 갈수록 짙게
    c.fillStyle = `rgba(10,14,34,${0.16 * (5 - i)})`;
    c.fillRect(0, 0, vw, Math.round((gy / 5) * (i + 1)));
  }
  // 별
  for (let i = 0; i < 90; i++) {
    const x = (i * 73) % vw, y = (i * 137) % gy;
    const tw = 0.35 + 0.65 * ((Math.sin(t * 3 + i) + 1) / 2);
    c.fillStyle = `rgba(255,255,255,${tw})`;
    c.fillRect(x, y, 1, 1);
  }
  // 달
  ell(c, Math.round(vw * 0.85), Math.round(gy * 0.22), 11, 11, '#fff3c4');
  ell(c, Math.round(vw * 0.85) - 4, Math.round(gy * 0.22) - 3, 8, 8, '#141f3d');

  // ---- 불꽃놀이
  const SHOWS = [
    { x: 0.16, y: 0.30, col: ['#ffd86b', '#fff3c4'], kind: 'burst', size: 46, off: 0.00 },
    { x: 0.38, y: 0.18, col: ['#ff8fc0', '#ffd6e8'], kind: 'ring', size: 40, off: 0.21 },
    { x: 0.62, y: 0.32, col: ['#8ef0a0', '#d8ffe0'], kind: 'burst', size: 52, off: 0.44 },
    { x: 0.82, y: 0.20, col: ['#9fd8ff', '#e0f4ff'], kind: 'willow', size: 44, off: 0.63 },
    { x: 0.28, y: 0.46, col: ['#c79bff', '#eddcff'], kind: 'ring', size: 34, off: 0.12 },
    { x: 0.52, y: 0.50, col: ['#ffb36b', '#ffe4c4'], kind: 'burst', size: 36, off: 0.77 },
    { x: 0.72, y: 0.46, col: ['#ff7a7a', '#ffd0d0'], kind: 'willow', size: 38, off: 0.35 },
    { x: 0.46, y: 0.26, col: ['#ffffff', '#cfe4ff'], kind: 'burst', size: 58, off: 0.55 },
  ];
  for (const f of SHOWS) {
    const cyc = (t * 0.42 + f.off) % 1;
    const cx = Math.round(vw * f.x), cy0 = Math.round(gy * f.y);

    // 쏘아 올라가는 불씨
    if (cyc < 0.22) {
      const up = cyc / 0.22;
      const y = Math.round(gy - (gy - cy0) * up);
      c.globalAlpha = 1;
      c.fillStyle = f.col[1];
      c.fillRect(cx, y, 1, 2);
      c.fillStyle = 'rgba(255,220,140,0.5)';
      c.fillRect(cx, y + 3, 1, 4);
      continue;
    }

    const p = (cyc - 0.22) / 0.78;          // 0 -> 1 로 퍼짐
    const ease = 1 - Math.pow(1 - p, 2.2);  // 처음엔 빠르게, 뒤로 갈수록 느리게
    const r = f.size * ease;
    const alpha = Math.max(0, 1 - p * 1.05);
    const n = f.kind === 'ring' ? 22 : 18;

    // 한가운데 섬광
    if (p < 0.14) {
      c.globalAlpha = (1 - p / 0.14) * 0.9;
      ell(c, cx, cy0, 5 + p * 26, 5 + p * 26, '#ffffff');
    }

    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + f.off * 3;
      // willow 는 꼬리가 아래로 흘러내립니다
      const droop = f.kind === 'willow' ? p * p * f.size * 0.75 : 0;
      const rr = f.kind === 'ring' ? r : r * (0.72 + ((i * 37) % 10) / 22);
      const px0 = cx + Math.cos(a) * rr;
      const py0 = cy0 + Math.sin(a) * rr * 0.82 + droop;

      // 꼬리
      c.globalAlpha = alpha * 0.4;
      c.fillStyle = f.col[0];
      for (let k = 1; k <= 3; k++) {
        const q = 1 - k * 0.16;
        c.fillRect(Math.round(cx + Math.cos(a) * rr * q),
          Math.round(cy0 + Math.sin(a) * rr * 0.82 * q + droop * q), 1, 1);
      }
      // 머리 불꽃
      c.globalAlpha = alpha;
      c.fillStyle = p < 0.45 ? f.col[1] : f.col[0];
      c.fillRect(Math.round(px0), Math.round(py0), 2, 2);
    }

    // 흩날리는 잔불
    c.globalAlpha = alpha * 0.7;
    c.fillStyle = f.col[1];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + t;
      const rr = r * (1.08 + ((i * 53) % 12) / 40);
      c.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy0 + Math.sin(a) * rr * 0.8 + p * 12), 1, 1);
    }
  }
  c.globalAlpha = 1;

  // ---- 마을 (집 · 나무)
  const HOUSES = [0.13, 0.40, 0.68, 0.90];
  const TREES = [0.05, 0.24, 0.32, 0.52, 0.58, 0.78, 0.84, 0.97];
  const back = [];
  for (const hx of HOUSES) back.push({ k: 'house', x: vw * hx, y: gy + 6 + ((hx * 97) % 5) });
  for (const tx of TREES) back.push({ k: 'tree', x: vw * tx, y: gy + 9 + ((tx * 131) % 7), seed: tx * 20 });
  back.sort((a, b) => a.y - b.y);

  // 잔디밭
  c.fillStyle = '#2a6b28'; c.fillRect(0, gy, vw, vh - gy);
  c.fillStyle = '#357d31'; c.fillRect(0, gy, vw, 3);
  c.fillStyle = '#215a20';
  for (let i = 0; i < 220; i++) {
    c.fillRect((i * 37) % vw, gy + 4 + ((i * 53) % Math.max(1, vh - gy - 6)), 1, 3);
  }

  for (const o of back) {
    if (o.k === 'house') drawHouse(c, o.x, o.y);
    else drawTree(c, o.x, o.y, o.seed, t);
  }

  // ---- 꽃밭
  for (let i = 0; i < 70; i++) {
    const x = 6 + ((i * 61) % (vw - 12));
    const y = gy + 10 + ((i * 43) % Math.max(1, castY - gy - 2));
    drawFlower(c, x, y, i);
  }

  // ---- 다 같이 웃으며 등장
  const baseY = castY;
  const cast = [];

  // 삐로디들 (이제는 친구!)
  const PIRODI_X = [0.14, 0.26, 0.63, 0.76, 0.88];
  PIRODI_X.forEach((px0, i) => {
    const hop = Math.abs(Math.sin(t * 3.4 + i * 1.1)) * 5;
    cast.push({
      y: baseY - 6 + ((i * 29) % 9),
      draw: (yy) => drawPirodi(c, Math.round(vw * px0), Math.round(yy - hop),
        { t: t + i, hp: 3, maxHp: 3, happy: true }),
    });
  });

  // 엄마
  const momHop = Math.abs(Math.sin(t * 2.4)) * 3;
  cast.push({
    y: baseY - 2,
    draw: (yy) => drawMom(c, Math.round(vw * 0.42), Math.round(yy - momHop), { t }),
  });

  // 스톤
  const stoneHop = Math.abs(Math.sin(t * 4)) * 8;
  cast.push({
    y: baseY,
    draw: (yy) => drawStone(c, Math.round(vw * 0.52), Math.round(yy - stoneHop), {
      facing: 'down', walk: t * 5, moving: false, expr: 'happy',
      aim: -Math.PI / 2,
      swing: { limb: 'arm', p: (Math.sin(t * 4) + 1) / 2 },
    }),
  });

  cast.sort((a, b) => a.y - b.y);
  for (const m of cast) m.draw(m.y);

  // ---- 바닥에 떨어지는 색종이
  for (let i = 0; i < 40; i++) {
    const sp = 14 + (i % 5) * 5;
    const x = ((i * 83) + Math.sin(t * 1.4 + i) * 12) % vw;
    const y = ((i * 61) + t * sp) % vh;
    c.fillStyle = ['#ffd86b', '#ff8fc0', '#8ef0a0', '#9fd8ff', '#c79bff'][i % 5];
    c.fillRect(Math.round(x), Math.round(y), 2, 1);
  }
}
