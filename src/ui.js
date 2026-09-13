// 화면 위에 얹는 글자와 창들.
// 이 부분만 화면 원래 해상도로 그려서 한글이 또렷하게 보입니다.

import { CFG } from './config.js';
import { drawBomb } from './sprites.js';

const FONT = '"Galmuri11","DungGeunMo","Malgun Gothic","Apple SD Gothic Neo",sans-serif';

export function text(ctx, str, x, y, size, color, opts = {}) {
  const { align = 'center', baseline = 'middle', outline = '#14210f', weight = 800, alpha = 1, lw } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (outline) {
    ctx.lineWidth = lw ?? Math.max(3, size * 0.22);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = outline;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function measure(ctx, str, size, weight = 800) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`;
  return ctx.measureText(str).width;
}

/** 픽셀 느낌의 두꺼운 테두리 상자 */
export function panel(ctx, x, y, w, h, opts = {}) {
  const { fill = 'rgba(28,48,26,0.94)', border = '#f2e7c8', border2 = '#3d6b33', b = 4 } = opts;
  ctx.save();
  ctx.fillStyle = '#12200f';
  ctx.fillRect(x - b * 2, y - b * 2, w + b * 4, h + b * 4);
  ctx.fillStyle = border;
  ctx.fillRect(x - b, y - b, w + b * 2, h + b * 2);
  ctx.fillStyle = border2;
  ctx.fillRect(x - b / 2, y - b / 2, w + b, h + b);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** 위에 붙는 점수 / 스테이지 / 남은 삐로디 */
export function drawHUD(ctx, G, st) {
  const u = G.scale;
  const pad = 6 * u;
  const s = 9 * u;

  ctx.save();
  // 반투명 띠
  const grad = ctx.createLinearGradient(0, 0, 0, 22 * u);
  grad.addColorStop(0, 'rgba(10,26,10,0.55)');
  grad.addColorStop(1, 'rgba(10,26,10,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, G.W, 22 * u);
  ctx.restore();

  text(ctx, `점수 ${st.score}`, pad, 11 * u, s, '#fff27a', { align: 'left' });
  text(ctx, `스테이지 ${st.stage + 1}`, G.W / 2, 11 * u, s, '#bdf0ff');

  const left = st.pirodis.filter((p) => !p.dead).length;
  if (st.boss && !st.boss.dead) {
    text(ctx, '최종 보스 · 엄마', G.W - pad, 11 * u, s, '#ff6b6b', { align: 'right' });
  } else {
    text(ctx, `삐로디 ${left}`, G.W - pad, 11 * u, s, left > 0 ? '#a8f06a' : '#ffffff', { align: 'right' });
  }

  // ---- 남은 핵폭탄 (점수 아래에 아이콘으로)
  const total = CFG.NUKE.start;
  const have = st.nukes ?? 0;
  // 배율이 소수면 칸마다 반올림이 달라져서 아이콘이 들쭉날쭉해집니다.
  // 반드시 정수 배율로 그려야 도트가 깨끗하게 나옵니다.
  const iconS = Math.max(1, Math.round(u * 0.55));
  const stepX = 16 * iconS;                // 폭탄 폭(14) + 여백
  const baseX = pad + 7 * iconS;
  const baseY = 22 * u + 26 * iconS;
  for (let i = 0; i < total; i++) {
    drawBomb(ctx, baseX + i * stepX, baseY, iconS, { dim: i >= have });
  }
}

/** 화면 가운데 크게 떴다 사라지는 문구 */
export function drawBanner(ctx, G, main, sub, alpha) {
  const u = G.scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  const bh = 44 * u;
  ctx.fillStyle = 'rgba(12,28,12,0.62)';
  ctx.fillRect(0, G.H / 2 - bh / 2, G.W, bh);
  ctx.fillStyle = '#f2e7c8';
  ctx.fillRect(0, G.H / 2 - bh / 2, G.W, 2 * u);
  ctx.fillRect(0, G.H / 2 + bh / 2 - 2 * u, G.W, 2 * u);
  ctx.restore();

  text(ctx, main, G.W / 2, G.H / 2 - (sub ? 7 * u : 0), 20 * u, '#fff27a', { alpha });
  if (sub) text(ctx, sub, G.W / 2, G.H / 2 + 12 * u, 9 * u, '#d8f0d0', { alpha });
}

/**
 * 위아래 화살표로 고르는 메뉴 창.
 * items: [{label, disabled}]
 */
export function drawMenu(ctx, G, title, items, index, opts = {}) {
  const u = G.scale;
  const titleSize = 13 * u;
  const itemSize = 11 * u;
  const lineH = 20 * u;

  let w = 150 * u;
  for (const it of items) w = Math.max(w, measure(ctx, it.label, itemSize) + 60 * u);
  w = Math.max(w, measure(ctx, title, titleSize) + 40 * u);
  const h = 26 * u + items.length * lineH + 12 * u;
  const x = Math.round(G.W / 2 - w / 2);
  const y = Math.round(G.H / 2 - h / 2);

  if (opts.dim !== false) {
    ctx.fillStyle = 'rgba(6,16,8,0.55)';
    ctx.fillRect(0, 0, G.W, G.H);
  }
  panel(ctx, x, y, w, h, { b: Math.max(3, 1.2 * u) });

  text(ctx, title, G.W / 2, y + 16 * u, titleSize, '#fff27a');
  ctx.fillStyle = '#3d6b33';
  ctx.fillRect(x + 10 * u, y + 27 * u, w - 20 * u, Math.max(1, u * 0.6));

  items.forEach((it, i) => {
    const iy = y + 40 * u + i * lineH;
    const on = i === index;
    const col = it.disabled ? '#7b8a78' : on ? '#fff27a' : '#dcf0d4';
    if (on) {
      ctx.fillStyle = 'rgba(255,242,122,0.14)';
      ctx.fillRect(x + 8 * u, iy - 9 * u, w - 16 * u, 18 * u);
      text(ctx, '▶', x + 20 * u, iy, itemSize * 0.85, '#fff27a');
    }
    text(ctx, it.label, G.W / 2 + 6 * u, iy, itemSize, col);
  });

  return { x, y, w, h };
}

/** 아래쪽 조작 안내 */
export function drawHint(ctx, G, str, alpha = 0.8) {
  text(ctx, str, G.W / 2, G.H - 16 * G.scale, 8 * G.scale, '#cfe9d4', { alpha });
}
