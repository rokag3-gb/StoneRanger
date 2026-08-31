// 캐릭터 선택 - 좌우 화살표로 슬라이드. 스톤만 고를 수 있고 ?? 는 잠겨 있습니다.

import { G } from '../state.js';
import { Input } from '../input.js';
import { Sound } from '../audio.js';
import { drawScenery } from '../scenery.js';
import { drawStone, drawSilhouette } from '../sprites.js';
import { text, panel, drawHint } from '../ui.js';

const CHARS = [
  { name: '스톤', desc: '돌 팔다리로 두두다다!', locked: false },
  { name: '??', desc: '아직 잠겨 있어요', locked: true },
];

export const selectScene = {
  t: 0,
  index: 0,
  slide: 0,      // 부드럽게 따라오는 위치

  enter() {
    this.t = 0;
    this.index = 0;
    this.slide = 0;
    Sound.bgm('intro');
  },

  update(dt) {
    this.t += dt;

    if (Input.justPressed('ArrowLeft') && this.index > 0) {
      this.index--; Sound.sfx('move');
    }
    if (Input.justPressed('ArrowRight') && this.index < CHARS.length - 1) {
      this.index++; Sound.sfx('move');
    }

    // 목표 위치로 부드럽게 미끄러짐
    this.slide += (this.index - this.slide) * Math.min(1, dt * 11);

    if (Input.justPressed('Enter')) {
      if (CHARS[this.index].locked) {
        Sound.sfx('deny');
      } else {
        Sound.sfx('select');
        G.reset();
        G.go('play', { stage: 0 });
      }
    }
    if (Input.justPressed('Escape')) {
      Sound.sfx('back');
      G.go('intro');
    }
  },

  /**
   * 화면 아래에서부터 차곡차곡 쌓아 올려 자리를 잡습니다.
   * (고정 비율로 배치했더니 창 높이에 따라 이름 카드와 시작 버튼이 겹쳤습니다)
   */
  layout() {
    const u = G.scale;
    const hintY = G.H - 16 * u;                  // 맨 아래 안내 문구
    const bh = 26 * u;                           // 시작 버튼
    const by = Math.round(hintY - 15 * u - bh);
    const ph = 50 * u;                           // 이름 카드
    const py = Math.round(by - 12 * u - ph);
    const charBaseV = Math.round(py / u) - 10;   // 캐릭터 발이 닿는 높이 (가상 좌표)
    return { u, hintY, bh, by, ph, py, charBaseV };
  },

  // 도트 레이어
  draw() {
    const c = G.vctx;
    drawScenery(c, G.vw, G.vh, this.t, { speed: 6, dim: 0.28 });

    // ---- 캐릭터 카드들이 좌우로 슬라이드
    const step = G.vw * 0.62;
    const baseY = this.layout().charBaseV;
    CHARS.forEach((ch, i) => {
      const dx = (i - this.slide) * step;
      const x = Math.round(G.vw / 2 + dx);
      if (x < -90 || x > G.vw + 90) return;
      const focus = 1 - Math.min(1, Math.abs(i - this.slide));

      c.save();
      c.globalAlpha = 0.35 + focus * 0.65;
      if (ch.locked) {
        drawSilhouette(c, x, baseY, this.t);
      } else {
        const bounce = Math.sin(this.t * 3) * 1.5;
        drawStone(c, x, baseY - bounce, {
          facing: 'down',
          walk: this.t * 4,
          moving: false,
          expr: focus > 0.6 ? 'happy' : 'normal',
        });
      }
      c.restore();
    });
  },

  // 글자 레이어
  drawUI() {
    const ctx = G.ctx;
    const { u, bh, by, ph, py, charBaseV } = this.layout();

    // ---- 제목
    text(ctx, '캐릭터 선택', G.W / 2, G.H * 0.13, 22 * u, '#fff27a');

    // ---- 이름 카드
    const cur = CHARS[this.index];
    const pw = 210 * u;
    const px = Math.round(G.W / 2 - pw / 2);
    panel(ctx, px, py, pw, ph, { b: Math.max(3, 1.2 * u) });
    text(ctx, cur.name, G.W / 2, py + 16 * u, 17 * u, cur.locked ? '#9aa89a' : '#ffffff');
    text(ctx, cur.desc, G.W / 2, py + 37 * u, 9 * u, cur.locked ? '#8b9a8b' : '#cfeecf');

    // ---- 좌우 화살표 (캐릭터 몸통 높이에 맞춤)
    const ay = (charBaseV - 12) * u;
    const pulse = 0.55 + 0.45 * Math.sin(this.t * 5);
    if (this.index > 0) text(ctx, '◀', G.W * 0.16, ay, 26 * u, '#ffffff', { alpha: pulse });
    else text(ctx, '◀', G.W * 0.16, ay, 26 * u, '#5d6b5d', { alpha: 0.4 });
    if (this.index < CHARS.length - 1) text(ctx, '▶', G.W * 0.84, ay, 26 * u, '#ffffff', { alpha: pulse });
    else text(ctx, '▶', G.W * 0.84, ay, 26 * u, '#5d6b5d', { alpha: 0.4 });

    // ---- 시작 버튼 (스톤일 때만 활성)
    const bw = 150 * u;
    const bx = Math.round(G.W / 2 - bw / 2);
    const on = !cur.locked;
    ctx.save();
    ctx.fillStyle = '#12200f';
    ctx.fillRect(bx - 3 * u, by - 3 * u, bw + 6 * u, bh + 6 * u);
    ctx.fillStyle = on ? '#4ac04a' : '#4a554a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = on ? '#6ee06e' : '#5b665b';
    ctx.fillRect(bx, by, bw, 4 * u);
    ctx.restore();
    text(ctx, '시작', G.W / 2, by + bh / 2, 13 * u, on ? '#ffffff' : '#8b968b',
      { alpha: on ? 0.75 + 0.25 * Math.sin(this.t * 6) : 1 });

    drawHint(ctx, G, on ? '◀ ▶ 캐릭터 고르기 · 엔터 시작 · ESC 뒤로'
      : '이 캐릭터는 아직 잠겨 있어요 · ◀ 로 스톤을 골라주세요', 0.85);
  },
};
