// 인트로 화면 - 풍경이 흘러가고, 2초 뒤부터 PRESS ENTER 가 깜빡입니다.

import { G } from '../state.js';
import { Input } from '../input.js';
import { Sound } from '../audio.js';
import { drawScenery } from '../scenery.js';
import { drawStone } from '../sprites.js';
import { text } from '../ui.js';

export const introScene = {
  t: 0,
  stoneX: 0,

  enter() {
    this.t = 0;
    this.stoneX = -40;
    G.reset();
    Sound.bgm('intro');
  },

  update(dt) {
    this.t += dt;
    // 스톤이 화면을 가로질러 산책합니다
    this.stoneX += 26 * dt;
    if (this.stoneX > G.vw + 40) this.stoneX = -40;

    if (this.t > 0.6 && Input.justPressed('Enter')) {
      Sound.sfx('select');
      G.go('select');
    }
  },

  // 도트 레이어
  draw() {
    const c = G.vctx;
    drawScenery(c, G.vw, G.vh, this.t, { speed: 16 });

    // 산책하는 스톤
    drawStone(c, this.stoneX, Math.round(G.vh * 0.82), {
      facing: 'right', walk: this.t * 11, moving: true, expr: 'normal',
    });
  },

  // 글자 레이어
  drawUI() {
    const ctx = G.ctx, u = G.scale;
    const cx = G.W / 2;
    const titleY = G.H * 0.30;
    const wob = Math.sin(this.t * 1.6) * 3 * u;

    // 제목 뒤 돌판
    ctx.save();
    ctx.globalAlpha = 0.85;
    const pw = 300 * u, ph = 76 * u;
    ctx.fillStyle = '#6a4222';
    ctx.fillRect(cx - pw / 2, titleY - ph / 2 + wob, pw, ph);
    ctx.fillStyle = '#8d5c33';
    ctx.fillRect(cx - pw / 2 + 3 * u, titleY - ph / 2 + 3 * u + wob, pw - 6 * u, ph - 6 * u);
    ctx.fillStyle = '#ad7444';
    ctx.fillRect(cx - pw / 2 + 3 * u, titleY - ph / 2 + 3 * u + wob, pw - 6 * u, 4 * u);
    ctx.restore();

    text(ctx, '스톤 레인저', cx, titleY + wob - 6 * u, 36 * u, '#ffe9a8', { outline: '#3a2011', lw: 9 * u });
    text(ctx, 'STONE RANGER', cx, titleY + wob + 24 * u, 11 * u, '#ffd2e8', { outline: '#3a2011' });

    // ---- PRESS ENTER (2초 후부터 깜빡)
    if (this.t > 2) {
      const blink = (Math.sin((this.t - 2) * 5) + 1) / 2;
      text(ctx, 'PRESS ENTER', cx, G.H * 0.76, 16 * u, '#ffffff', { alpha: 0.25 + blink * 0.75 });
    }

    // ---- 화면 아래 안내와 크레딧
    // 브라우저가 자동재생을 막아서 아직 소리가 안 나는 동안에만 안내합니다.
    // (자동재생이 허용된 브라우저에서는 이 문구가 아예 보이지 않습니다)
    if (!Sound.bgmActive()) {
      const blink = 0.55 + 0.45 * Math.sin(this.t * 4);
      text(ctx, '아무 키나 누르면 소리가 켜져요', G.W / 2, G.H - 42 * u, 8 * u, '#ffe9a8', { alpha: blink });
    }

    text(ctx, '화살표 이동 · 스페이스 또는 Z 공격 · 엔터 확인 · ESC 메뉴',
      G.W / 2, G.H - 26 * u, 8 * u, '#cfe9d4', { alpha: 0.72 });

    text(ctx, '기획 및 일러스트 KDH · 개발 KJW · ⓒ PEACHSOFT 2026',
      G.W / 2, G.H - 11 * u, 6.5 * u, '#b3d2ba', { alpha: 0.62 });
  },
};
