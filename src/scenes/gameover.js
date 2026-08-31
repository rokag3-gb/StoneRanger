// 게임 오버 - 슬퍼하는 스톤과 "다시 처음으로" 메뉴.

import { G } from '../state.js';
import { Input } from '../input.js';
import { Sound } from '../audio.js';
import { drawStone, ell } from '../sprites.js';
import { text, panel, drawHint } from '../ui.js';

export const gameoverScene = {
  enter() {
    this.t = 0;
    this.score = G.score;
    this.stage = G.stage;
    Sound.bgm('gameover');
  },

  update(dt) {
    this.t += dt;
    if (this.t > 0.8 && (Input.justPressed('Enter') || Input.justPressed('Escape'))) {
      Sound.sfx('back');
      Sound.stopBgm();
      G.go('intro');
    }
  },

  // 도트 레이어
  draw() {
    const c = G.vctx;
    const vw = G.vw, vh = G.vh;

    // ---- 비 오는 어두운 하늘
    c.fillStyle = '#2a3348'; c.fillRect(0, 0, vw, vh);
    c.fillStyle = '#333e56'; c.fillRect(0, 0, vw, Math.round(vh * 0.5));
    // 빗줄기
    c.fillStyle = 'rgba(160,190,220,0.35)';
    for (let i = 0; i < 90; i++) {
      const x = ((i * 53) + (this.t * 60 * ((i % 3) + 1))) % (vw + 40) - 20;
      const y = ((i * 97) + (this.t * 260 * ((i % 3) + 1))) % vh;
      c.fillRect(Math.round(x), Math.round(y), 1, 5);
    }
    // 젖은 잔디
    const gy = Math.round(vh * 0.78);
    c.fillStyle = '#25602a'; c.fillRect(0, gy, vw, vh - gy);
    c.fillStyle = '#2d7031'; c.fillRect(0, gy, vw, 3);
    c.fillStyle = '#1d4f22';
    for (let i = 0; i < 120; i++) {
      c.fillRect((i * 37) % vw, gy + 4 + ((i * 53) % Math.max(1, vh - gy - 6)), 1, 3);
    }

    // ---- 축 처진 스톤
    const droop = Math.sin(this.t * 1.4) * 1.2;
    const sx = Math.round(vw / 2), sy = Math.round(vh * 0.90);
    ell(c, sx, sy - 1, 11, 3.5, 'rgba(0,0,0,0.28)');
    drawStone(c, sx, sy + droop, { facing: 'down', walk: this.t * 1.2, moving: false, expr: 'sad' });

    // 떨어지는 눈물방울
    for (let i = 0; i < 3; i++) {
      const p = ((this.t * 0.9 + i * 0.33) % 1);
      c.fillStyle = 'rgba(168,220,255,0.9)';
      c.fillRect(sx + 4, Math.round(sy - 26 + p * 22), 1, 2);
    }

    c.fillStyle = 'rgba(10,14,26,0.35)';
    c.fillRect(0, 0, vw, vh);
  },

  // 글자 레이어
  drawUI() {
    const ctx = G.ctx, u = G.scale;

    const a = Math.min(1, this.t / 0.6);
    text(ctx, '게임 오버', G.W / 2, G.H * 0.20, 34 * u, '#ff8f8f', { alpha: a });
    text(ctx, '스톤이 지쳤어요...', G.W / 2, G.H * 0.31, 12 * u, '#dfe8f5', { alpha: a });

    const pw = 240 * u, ph = 52 * u;
    const px = Math.round(G.W / 2 - pw / 2), py = Math.round(G.H * 0.40);
    panel(ctx, px, py, pw, ph, { b: Math.max(3, 1.2 * u), fill: 'rgba(26,32,48,0.94)', border2: '#4a5570' });
    text(ctx, `스테이지 ${this.stage + 1} · 점수`, G.W / 2, py + 15 * u, 9 * u, '#b8c6dd');
    text(ctx, String(this.score), G.W / 2, py + 36 * u, 20 * u, '#ffffff');

    if (this.t > 0.8) {
      const blink = 0.45 + 0.55 * ((Math.sin(this.t * 4.5) + 1) / 2);
      const bw = 180 * u, bh = 26 * u;
      const bx = Math.round(G.W / 2 - bw / 2), by = Math.round(G.H * 0.62);
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#12162a'; ctx.fillRect(bx - 3 * u, by - 3 * u, bw + 6 * u, bh + 6 * u);
      ctx.fillStyle = '#4a5570'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#6b7899'; ctx.fillRect(bx, by, bw, 4 * u);
      ctx.restore();
      text(ctx, '▶ 다시 처음으로', G.W / 2, by + bh / 2, 12 * u, '#ffffff', { alpha: blink });
      drawHint(ctx, G, '엔터 또는 ESC 를 누르세요', 0.85);
    }
  },
};
