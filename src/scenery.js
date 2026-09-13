// 인트로 / 캐릭터 선택 / 게임 오버 화면에서 뒤로 흘러가는 풍경.
// 아이 그림처럼 파란 하늘 + 해 + 초록 잔디 + 나무 + 주황 집으로 만들었습니다.

import { C, ell, drawSun, drawCloud, drawTree, drawHouse } from './sprites.js';
import { drawFlower } from './world.js';

export function drawScenery(c, vw, vh, t, opts = {}) {
  const speed = opts.speed ?? 14;
  const horizon = Math.round(vh * 0.46);
  const dim = opts.dim ?? 0;

  // ---- 하늘 (몇 단계로 나눠 칠해서 도트 느낌)
  const bands = ['#4fa8ec', '#5cb2f0', '#69bcf4', '#7ac6f7', '#8ed2fa'];
  for (let i = 0; i < bands.length; i++) {
    const y0 = Math.round((horizon / bands.length) * i);
    const y1 = Math.round((horizon / bands.length) * (i + 1));
    c.fillStyle = bands[i];
    c.fillRect(0, y0, vw, y1 - y0);
  }

  // ---- 해
  drawSun(c, Math.round(vw * 0.72), Math.round(horizon * 0.36), t);

  // ---- 구름 (천천히 흐름)
  const cw = vw + 120;
  for (let i = 0; i < 4; i++) {
    const x = ((i * 137 + t * speed * 0.35) % cw) - 60;
    const y = 18 + ((i * 53) % 36);
    drawCloud(c, x, y, 0.8 + (i % 3) * 0.22);
  }

  // ---- 먼 언덕
  c.fillStyle = '#2f7a2b';
  for (let x = 0; x < vw; x++) {
    const h = 12 + Math.sin((x + t * speed * 0.3) * 0.018) * 6 + Math.sin((x + t * speed * 0.3) * 0.05) * 3;
    c.fillRect(x, horizon - h, 1, h + 4);
  }
  c.fillStyle = '#3a8f32';
  for (let x = 0; x < vw; x++) {
    const h = 7 + Math.sin((x + t * speed * 0.5 + 300) * 0.023) * 4;
    c.fillRect(x, horizon - h, 1, h + 4);
  }

  // ---- 잔디밭
  c.fillStyle = C.grass[0];
  c.fillRect(0, horizon, vw, vh - horizon);
  c.fillStyle = C.grass[2];
  c.fillRect(0, horizon, vw, 3);
  // 크레용 결
  c.fillStyle = C.grassDark;
  for (let i = 0; i < 260; i++) {
    const sx = ((i * 61 + t * speed * 1.3) % (vw + 40)) - 20;
    const sy = horizon + 4 + ((i * 37) % Math.max(1, vh - horizon - 6));
    c.fillRect(Math.round(sx), Math.round(sy), 1, 3);
  }

  // ---- 잔디밭에 핀 꽃 (지도 배경과 같은 그림, 뒤에서 앞으로 흘러갑니다)
  const flw = vw + 60;
  for (let i = 0; i < 46; i++) {
    const x = ((i * 71 - t * speed * 1.1) % flw + flw) % flw - 30;
    const y = horizon + 8 + ((i * 29) % Math.max(1, vh - horizon - 14));
    drawFlower(c, Math.round(x), Math.round(y), i);
  }

  // ---- 중간 거리의 나무와 집 (조금 더 빨리 흐름)
  const mw = vw + 260;
  const mid = [
    { k: 'tree', o: 0 }, { k: 'house', o: 90 }, { k: 'tree', o: 190 },
    { k: 'tree', o: 240 }, { k: 'house', o: 330 }, { k: 'tree', o: 420 },
    { k: 'tree', o: 470 },
  ];
  for (const m of mid) {
    const x = ((m.o - t * speed * 0.9) % mw + mw) % mw - 130;
    const y = horizon + 12 + ((m.o * 7) % 10);
    if (m.k === 'tree') drawTree(c, x, y, m.o * 0.3, t);
    else drawHouse(c, x, y);
  }

  // ---- 앞쪽 풀숲 (가장 빠르게 흐름)
  const fw = vw + 90;
  for (let i = 0; i < 22; i++) {
    const x = ((i * 41 - t * speed * 2.1) % fw + fw) % fw - 45;
    const y = vh - 6 + ((i * 13) % 8);
    ell(c, x, y, 11, 6, '#2f7a2b');
    ell(c, x - 4, y - 3, 7, 5, '#3a8f32');
    ell(c, x + 5, y - 2, 6, 4, '#45a03a');
  }

  if (dim > 0) {
    c.fillStyle = `rgba(6,16,8,${dim})`;
    c.fillRect(0, 0, vw, vh);
  }
}
