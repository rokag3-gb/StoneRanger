// 도트 그림 - 안티앨리어싱 없이 픽셀 단위로 직접 그립니다.
// 캔버스 자체가 저해상도라서 이렇게 그리면 마인크래프트 같은 각진 도트 느낌이 납니다.

// ---------------------------------------------------------------- 기본 도형

/** 픽셀에 딱 붙는 타원 (가로 한 줄씩 fillRect) */
export function ell(c, cx, cy, rx, ry, color) {
  if (rx <= 0 || ry <= 0) return;
  c.fillStyle = color;
  const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (dy < -1 || dy > 1) continue;
    const w = rx * Math.sqrt(1 - dy * dy);
    const xa = Math.round(cx - w), xb = Math.round(cx + w);
    if (xb > xa) c.fillRect(xa, y, xb - xa, 1);
  }
}

/** 테두리가 있는 타원 */
export function ellOut(c, cx, cy, rx, ry, fill, outline, t = 1) {
  ell(c, cx, cy, rx + t, ry + t, outline);
  ell(c, cx, cy, rx, ry, fill);
}

export function px(c, x, y, color, w = 1, h = 1) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

/** 아래로 벌어지는 삼각형 (지붕) */
export function tri(c, cx, topY, halfW, h, color) {
  c.fillStyle = color;
  for (let i = 0; i < h; i++) {
    const w = Math.round(halfW * (i / h));
    c.fillRect(Math.round(cx - w), Math.round(topY + i), w * 2 + 1, 1);
  }
}

// ---------------------------------------------------------------- 작은 도트 숫자 (3x5)

const GLYPHS = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  'x': ['000', '101', '010', '101', '000'],
};

/** 도트 숫자 그리기. 중앙 정렬, 검은 외곽선 포함 */
export function dotNum(c, str, cx, y, color, outline = '#1d1526') {
  const w = str.length * 4 - 1;
  let x = Math.round(cx - w / 2);
  for (const ch of str) {
    const g = GLYPHS[ch];
    if (!g) { x += 4; continue; }
    for (let r = 0; r < 5; r++) {
      for (let k = 0; k < 3; k++) {
        if (g[r][k] !== '1') continue;
        px(c, x + k - 1, y + r, outline); px(c, x + k + 1, y + r, outline);
        px(c, x + k, y + r - 1, outline); px(c, x + k, y + r + 1, outline);
      }
    }
    x += 4;
  }
  x = Math.round(cx - w / 2);
  for (const ch of str) {
    const g = GLYPHS[ch];
    if (!g) { x += 4; continue; }
    for (let r = 0; r < 5; r++) {
      for (let k = 0; k < 3; k++) if (g[r][k] === '1') px(c, x + k, y + r, color);
    }
    x += 4;
  }
}

// ---------------------------------------------------------------- 색

export const C = {
  out: '#3a2740',
  body: '#c063cf', bodyHi: '#e6a4ea', bodySh: '#9a45aa',
  stone: '#8d5c33', stoneHi: '#ad7444', stoneSh: '#6a4222',
  white: '#ffffff', eye: '#1a1424', lid: '#2b45d8', lidHi: '#5a72ff',
  iris: '#4457dd', irisLo: '#8b9cf7',
  mouth: '#5a2a4a',

  jOut: '#2e5c1e', jelly: '#79c832', jellyHi: '#b4ef6a', jellySh: '#529b1c',

  grass: ['#5cba36', '#54ae31', '#66c73f'],
  grassDark: '#3f8f26',
  water: '#3aa0d8', waterHi: '#69c3ef', waterDeep: '#2a7fb4',
  sand: '#e3d39b',
  trunk: '#7d4a24', trunkSh: '#5d3517',
  leaf: '#2e8b34', leafHi: '#45ab45', leafSh: '#1f6a26',
  wall: '#e8862f', wallSh: '#c46a1d', roof: '#8b4220', roofSh: '#6d3218',
  win: '#7cc8f0',
  sky: '#66b8f0', skyHi: '#8fd0ff', sun: '#ffdb3d', sunHi: '#fff59a',
};

// ---------------------------------------------------------------- 스톤 (주인공)
//
// 좌표 원점은 "발이 닿는 바닥의 가운데".
// opts: { facing, walk, moving, swing:{limb,p,dir}|null, expr, flash, hidden }
//   expr: 'normal' | 'serious' | 'hurt' | 'happy' | 'sad'

export function drawStone(c, x, y, o = {}) {
  const facing = o.facing || 'down';
  const walk = o.walk || 0;
  const moving = !!o.moving;
  const swing = o.swing || null;
  const expr = o.expr || 'normal';
  const flash = !!o.flash;

  const out = flash ? '#ffffff' : C.out;
  const body = flash ? '#ffd9f4' : C.body;
  const bodyHi = flash ? '#ffffff' : C.bodyHi;
  const stone = flash ? '#ffe2c4' : C.stone;
  const stoneHi = flash ? '#ffffff' : C.stoneHi;

  const bob = moving ? Math.abs(Math.sin(walk * 2)) * 1.6 : Math.sin(walk * 0.9) * 0.6;
  const legSwing = moving ? Math.sin(walk) * 2.2 : 0;

  c.save();
  c.translate(Math.round(x), Math.round(y));

  const cy = -13 - bob;   // 몸통 중심

  // --- 그림자
  ell(c, 0, -1, 9, 3, 'rgba(20,45,15,0.28)');

  // --- 팔다리 위치 계산
  // 조준 각도를 그대로 따라가므로 좌상·우하 같은 대각선으로도 팔다리가 뻗습니다.
  const aim = o.aim ?? Math.PI / 2;
  const ax = Math.cos(aim), ay = Math.sin(aim);
  const side = ax >= 0 ? 1 : -1;              // 어느 쪽 팔·다리가 나갈지
  let armDx = 0, armDy = 0, legDx = 0, legDy = 0;
  if (swing) {
    const p = Math.sin(Math.min(1, swing.p) * Math.PI);     // 0 -> 1 -> 0
    if (swing.limb === 'arm') { armDx = ax * 9 * p; armDy = ay * 9 * p; }
    else { legDx = ax * 10 * p; legDy = ay * 10 * p; }
  }
  const onL = side < 0 ? 1 : 0, onR = side > 0 ? 1 : 0;

  // --- 다리 (몸통보다 먼저 = 뒤쪽)
  drawStoneChunk(c, -5 + legDx * onL, -4 + legSwing + legDy * onL, 4, 4.2, stone, stoneHi, out);
  drawStoneChunk(c, 5 + legDx * onR, -4 - legSwing + legDy * onR, 4, 4.2, stone, stoneHi, out);

  // --- 팔
  drawStoneChunk(c, -10.5 + armDx * onL, cy - 1 + armDy * onL, 4.4, 3.4, stone, stoneHi, out);
  drawStoneChunk(c, 10.5 + armDx * onR, cy - 1 + armDy * onR, 4.4, 3.4, stone, stoneHi, out);

  // --- 몸통
  const sq = swing ? 1 + 0.06 * Math.sin(Math.min(1, swing.p) * Math.PI) : 1;
  ellOut(c, 0, cy, 9 * sq, 9 / sq, body, out);
  ell(c, -3.5, cy - 4, 3.4, 2.4, bodyHi);     // 반짝이는 하이라이트
  ell(c, 4, cy + 4.5, 3.6, 2.2, C.bodySh);    // 아래쪽 그늘

  // --- 얼굴
  drawFace(c, 0, cy, expr, facing, out);

  c.restore();
}

/** 갈색 돌덩이 하나 (얼룩 무늬 포함) */
function drawStoneChunk(c, x, y, rx, ry, base, hi, out) {
  ellOut(c, x, y, rx, ry, base, out);
  ell(c, x - rx * 0.3, y - ry * 0.35, rx * 0.42, ry * 0.35, hi);
  px(c, x + rx * 0.25, y + ry * 0.1, C.stoneSh);
  px(c, x - rx * 0.15, y + ry * 0.45, C.stoneSh);
}

function drawFace(c, x, cy, expr, facing, out) {
  const ey = cy - 1.5;
  const ex = 3.7;
  const up = facing === 'up';

  if (expr === 'hurt') {
    // >_< 표정
    for (const s of [-1, 1]) {
      px(c, x + s * ex - 1.5, ey - 2, C.eye); px(c, x + s * ex - 0.5, ey - 1, C.eye);
      px(c, x + s * ex + 0.5, ey, C.eye); px(c, x + s * ex + 1.5, ey + 1, C.eye);
      px(c, x + s * ex + 1.5, ey - 2, C.eye); px(c, x + s * ex + 0.5, ey - 1, C.eye);
      px(c, x + s * ex - 1.5, ey + 1, C.eye);
    }
    ell(c, x, cy + 5, 2.6, 2, C.mouth);
    ell(c, x, cy + 5.5, 1.6, 1, '#ff9dc0');
    return;
  }

  if (expr === 'happy') {
    // ^ ^ 눈 + 활짝 웃는 입
    for (const s of [-1, 1]) {
      const bx = x + s * ex;
      px(c, bx - 2, ey + 1, C.eye); px(c, bx - 1, ey, C.eye);
      px(c, bx, ey - 1, C.eye); px(c, bx + 1, ey, C.eye); px(c, bx + 2, ey + 1, C.eye);
      px(c, bx - 2, ey + 2, C.eye); px(c, bx + 2, ey + 2, C.eye);
    }
    c.fillStyle = C.mouth;
    c.fillRect(Math.round(x - 3), Math.round(cy + 4), 6, 1);
    ell(c, x, cy + 5, 2.8, 2, C.mouth);
    ell(c, x, cy + 5.6, 1.8, 1.1, '#ff9dc0');
    // 볼 홍조
    ell(c, x - 7, cy + 2.5, 2, 1.2, 'rgba(255,120,170,0.6)');
    ell(c, x + 7, cy + 2.5, 2, 1.2, 'rgba(255,120,170,0.6)');
    return;
  }

  // 기본 / 진지 / 슬픔
  // 눈에 픽셀을 많이 할애해서 흰자 → 홍채 → 눈동자 → 반짝임 두 개까지 표현합니다.
  const squint = expr === 'serious' ? 1.0 : expr === 'sad' ? 0.7 : 0;
  const pupilY = expr === 'sad' ? 1.1 : up ? -0.8 : 0.5;
  const ERX = 3.0, ERY = 3.7 - squint * 0.5;

  for (const s of [-1, 1]) {
    const bx = x + s * ex;
    const ix = bx + s * 0.35;              // 눈동자 중심
    const iy = ey + pupilY;

    ellOut(c, bx, ey, ERX, ERY, C.white, out);                       // 흰자
    ell(c, bx, ey + ERY * 0.5, ERX * 0.8, ERY * 0.36, '#dce8fa');    // 아래쪽 옅은 반사
    ell(c, ix, iy, 2.0, 2.2, C.iris);                                // 홍채
    ell(c, ix, iy + 0.9, 1.6, 0.95, C.irisLo);                       // 홍채 아랫쪽 밝게
    ell(c, ix, iy, 1.05, 1.25, C.eye);                               // 눈동자
    px(c, ix - 1.3, iy - 1.4, C.white, 2, 2);                        // 큰 반짝임
    px(c, ix + 0.9, iy + 0.9, C.white);                              // 작은 반짝임

    // 파란 눈꺼풀 (흰자 위쪽만 덮습니다)
    const lidH = expr === 'serious' ? 3.0 : expr === 'sad' ? 1.5 : 2.1;
    for (let i = 0; i < lidH; i++) {
      const yy = ey - ERY + i;
      const dy = (yy + 0.5 - ey) / ERY;
      if (dy < -1 || dy > 1) continue;
      const w = ERX * Math.sqrt(1 - dy * dy);
      c.fillStyle = (i === Math.floor(lidH) - 1) ? C.lidHi : C.lid;
      c.fillRect(Math.round(bx - w), Math.round(yy), Math.max(1, Math.round(w * 2)), 1);
    }

    if (expr === 'serious') {   // 찡그린 눈썹
      c.fillStyle = out;
      c.fillRect(Math.round(bx - 2.8), Math.round(ey - 5.6), 6, 1);
      c.fillRect(Math.round(bx + (s < 0 ? 1.5 : -3.5)), Math.round(ey - 6.6), 3, 1);
    }
  }

  if (expr === 'sad') {
    ell(c, x, cy + 6, 2.4, 1.4, C.mouth);      // 아래로 처진 입
    c.fillStyle = '#ffffff';
    c.fillRect(Math.round(x + ex - 1), Math.round(ey + 3), 1, 3);   // 눈물
    px(c, x + ex - 1, ey + 6, '#a8dcff');
  } else if (expr === 'serious') {
    c.fillStyle = C.mouth;
    c.fillRect(Math.round(x - 2), Math.round(cy + 4.5), 4, 1);      // 꾹 다문 입
  } else {
    // 작은 미소
    px(c, x - 2, cy + 4, C.mouth); px(c, x - 1, cy + 5, C.mouth);
    px(c, x, cy + 5, C.mouth); px(c, x + 1, cy + 5, C.mouth);
    px(c, x + 2, cy + 4, C.mouth);
  }
}

/**
 * 엄마 (assets/캐릭터_엄마.jpg 참고)
 *
 * 회색 긴 머리, 주황빛 얼굴, 노란 무늬가 박힌 흰 상의, 청록 신발, 손에 든 책.
 * o.s 로 크기를 키웁니다 - 최종 보스일 때는 s=2 (스톤의 약 2배).
 * o.happy 를 주면 엔딩용으로 활짝 웃습니다.
 */
export function drawMom(c, x, y, o = {}) {
  const s = o.s ?? 1;
  const t = o.t || 0;
  const walk = o.walk || 0;
  const moving = !!o.moving;
  const facing = o.facing || 'down';
  const flash = !!o.flash;
  const fx = facing === 'left' ? -1 : 1;

  const SKIN = flash ? '#ffd9b8' : '#dd9155';
  const SKIN_SH = flash ? '#e8b489' : '#b9743a';
  const HAIR = flash ? '#eaeaf0' : '#9b9ba6';
  const HAIR_SH = flash ? '#c2c2cc' : '#73737e';
  const HAIR_HI = flash ? '#ffffff' : '#bcbcc6';
  const TOP = flash ? '#ffffff' : '#f2f2ec';
  const TOP_SH = flash ? '#dedede' : '#cfcfc8';
  const YEL = flash ? '#fff9a8' : '#f2e23c';
  const TEAL = flash ? '#b4f4e8' : '#4fc4b0';
  const OUT = '#3a2a32';
  const BOOK = flash ? '#c8fff4' : '#3fb6a2';

  const bob = moving ? Math.abs(Math.sin(walk * 2)) * 1.1 : Math.sin(walk * 0.9) * 0.4;
  const legSwing = moving ? Math.sin(walk) * 1.5 : 0;
  const sway = Math.sin(t * 1.7) * 0.7;
  const bookLift = moving ? Math.sin(walk) * 0.8 : Math.sin(t * 2) * 0.5;

  // 단위 좌표 -> 실제 픽셀
  const P = (ax, ay, aw, ah, col) => {
    c.fillStyle = col;
    c.fillRect(Math.round(x + ax * s), Math.round(y + ay * s),
      Math.max(1, Math.round(aw * s)), Math.max(1, Math.round(ah * s)));
  };
  const E = (ax, ay, rx, ry, col) => ell(c, x + ax * s, y + ay * s, rx * s, ry * s, col);
  const EO = (ax, ay, rx, ry, fill, out) =>
    ellOut(c, x + ax * s, y + ay * s, rx * s, ry * s, fill, out, Math.max(1, Math.round(s * 0.7)));

  const B = -bob;   // 몸 전체 위아래 흔들림

  // --- 그림자
  E(0, -0.5, 7.5, 2.4, 'rgba(20,45,15,0.3)');

  // --- 뒤로 넘어간 머리카락 (얼굴보다 넓게 퍼집니다)
  EO(sway * 0.5, -18.5 + B, 8.5, 7.5, HAIR, HAIR_SH);
  P(-8.5 + sway, -19 + B, 3, 10, HAIR);          // 왼쪽으로 늘어진 머리
  P(5.5 + sway, -19 + B, 3, 10, HAIR);           // 오른쪽
  P(-8 + sway, -9.5 + B, 2, 2, HAIR_SH);
  P(6 + sway, -9.5 + B, 2, 2, HAIR_SH);

  // --- 다리와 청록 신발
  P(-3.4, -7 + B + legSwing, 3, 5, SKIN);
  P(0.4, -7 + B - legSwing, 3, 5, SKIN);
  P(-3.6, -7 + B + legSwing, 1, 5, SKIN_SH);
  P(0.2, -7 + B - legSwing, 1, 5, SKIN_SH);
  P(-4, -2 + B + legSwing, 4, 2.4, TEAL);
  P(0, -2 + B - legSwing, 4, 2.4, TEAL);

  // --- 뒤쪽 팔
  P(fx > 0 ? -7.2 : 4.7, -12.5 + B, 2.5, 6.5, SKIN);
  P(fx > 0 ? -7.4 : 6.9, -12.5 + B, 0.8, 6.5, OUT);

  // --- 상의 (흰 바탕에 노란 무늬)
  P(-5.5, -13.5 + B, 11, 6.5, TOP);
  P(3.5, -13.5 + B, 2, 6.5, TOP_SH);
  P(-5.5, -13.5 + B, 11, 1, OUT);
  E(0, -13.7 + B, 5.5, 1.6, TOP);
  P(-1, -12.5 + B, 2.5, 2, YEL);                 // 가슴 무늬
  P(-4.5, -10 + B, 2, 2, YEL);
  P(1.8, -9.5 + B, 2.2, 2, YEL);
  P(-5.5, -7.6 + B, 11, 1, TOP_SH);

  // --- 목
  P(-1.5, -15 + B, 3, 2, SKIN_SH);

  // --- 얼굴
  EO(sway * 0.6, -19.5 + B, 5.2, 6, SKIN, OUT);
  E(sway * 0.6 - 1.6, -22 + B, 2, 1.4, '#eaa96c');

  // --- 앞으로 흘러내린 앞머리
  P(-5.5 + sway, -25 + B, 11, 3, HAIR);
  E(sway * 0.6, -24.5 + B, 6, 2.6, HAIR);
  P(-5.8 + sway, -24 + B, 2, 6, HAIR);
  P(4 + sway, -24 + B, 2, 6, HAIR);
  P(-3 + sway, -25 + B, 1, 3, HAIR_HI);
  P(2 + sway, -25 + B, 1, 3, HAIR_HI);

  // --- 표정: 눈은 둘 다 ∧ 모양, 입만 다릅니다
  const ex = 2.3, ey = -20.2 + B + sway * 0.6 * 0;
  for (const d of [-1, 1]) {
    const bx = d * ex + sway * 0.6;
    P(bx - 1.8, ey + 0.9, 1, 1, OUT);
    P(bx - 0.9, ey + 0.1, 1, 1, OUT);
    P(bx, ey - 0.6, 1, 1, OUT);
    P(bx + 0.9, ey + 0.1, 1, 1, OUT);
    P(bx + 1.8, ey + 0.9, 1, 1, OUT);
    if (o.happy) E(bx, ey + 3, 1.5, 0.9, 'rgba(255,130,160,0.55)');
  }
  const mx = sway * 0.6, my = -17.2 + B;
  if (o.happy) {
    // 활짝 웃는 입
    P(mx - 1.8, my - 0.4, 4, 1, OUT);
    E(mx, my + 0.5, 2, 1.2, OUT);
    E(mx, my + 0.8, 1.3, 0.7, '#ff9dc0');
  } else {
    // 찌푸린 입 (아이 그림 그대로)
    P(mx - 2.2, my + 0.8, 1, 1, OUT);
    P(mx - 1.2, my + 0.1, 1, 1, OUT);
    P(mx - 0.2, my - 0.5, 1, 1, OUT);
    P(mx + 0.8, my + 0.1, 1, 1, OUT);
    P(mx + 1.8, my + 0.8, 1, 1, OUT);
  }

  // --- 앞쪽 팔 · 손 · 손에 든 책
  const ax = fx > 0 ? 4.7 : -7.2;
  P(ax, -12.5 + B, 2.5, 6.5, SKIN);
  P(fx > 0 ? 6.9 : -7.4, -12.5 + B, 0.8, 6.5, OUT);
  P(ax - 0.3, -6.5 + B + bookLift, 3, 2, SKIN);          // 책을 쥔 손
  const bx2 = fx > 0 ? 5.6 : -8.6;
  const by2 = -5.2 + B + bookLift;
  P(bx2 - 0.5, by2 - 0.5, 5, 5, OUT);            // 책 테두리
  P(bx2, by2, 4, 4, '#f6f2e2');                  // 책장
  P(bx2, by2, 1.6, 4, BOOK);                     // 표지
  P(bx2 + 2, by2 + 1, 2, 1, '#c9c2ab');
  P(bx2 + 2, by2 + 2.4, 2, 1, '#c9c2ab');
}

/** 스톤 실루엣 (캐릭터 선택 화면의 ?? 캐릭터) */
export function drawSilhouette(c, x, y, t) {
  const bob = Math.sin(t * 2) * 1.2;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  ell(c, 0, -1, 9, 3, 'rgba(20,45,15,0.25)');
  const dark = '#221a2e';
  ell(c, -5, -4, 4, 4.2, dark);
  ell(c, 5, -4, 4, 4.2, dark);
  ell(c, -10.5, -14 - bob, 4.4, 3.4, dark);
  ell(c, 10.5, -14 - bob, 4.4, 3.4, dark);
  ell(c, 0, -13 - bob, 9.5, 9.5, dark);
  // 물음표 눈
  px(c, -4, -15 - bob, '#5a4a6a', 2, 2);
  px(c, 3, -15 - bob, '#5a4a6a', 2, 2);
  c.restore();
}

// ---------------------------------------------------------------- 삐로디 (적)
//
// opts: { t, hp, maxHp, flash, pop, angry }

export function drawPirodi(c, x, y, o = {}) {
  const t = o.t || 0;
  const hp = o.hp ?? 3, maxHp = o.maxHp ?? 3;
  const flash = !!o.flash;
  const pop = o.pop || 0;       // 0..1 (죽는 중)

  const out = flash ? '#ffffff' : C.jOut;
  const jel = flash ? '#e8ffd0' : C.jelly;
  const hi = flash ? '#ffffff' : C.jellyHi;

  const wob = Math.sin(t * 5.5);
  const sizeByHp = 0.82 + 0.18 * (hp / maxHp);
  const s = sizeByHp * (1 + pop * 0.9);

  c.save();
  c.translate(Math.round(x), Math.round(y));
  if (pop > 0) c.globalAlpha = Math.max(0, 1 - pop);
  c.scale(1, 1);

  ell(c, 0, -1, 8 * s, 2.6 * s, 'rgba(20,45,15,0.25)');

  const sx = s * (1 + 0.10 * wob);
  const sy = s * (1 - 0.10 * wob);

  // 위로 뾰족한 뿔
  ellOut(c, 0, -13 * sy, 2.8 * sx, 5.2 * sy, jel, out);
  // 양옆 덩어리
  ellOut(c, -5.6 * sx, -7 * sy, 4.9 * sx, 5.4 * sy, jel, out);
  ellOut(c, 5.6 * sx, -6.6 * sy, 5.2 * sx, 5.8 * sy, jel, out);
  // 가운데 몸통
  ellOut(c, 0, -5.5 * sy, 7.6 * sx, 5.6 * sy, jel, out);
  // 젤리 광택
  ell(c, -2.6 * sx, -9 * sy, 2.6 * sx, 1.8 * sy, hi);
  ell(c, 4.5 * sx, -4 * sy, 1.6 * sx, 1.1 * sy, hi);
  ell(c, 2.5 * sx, -2 * sy, 3.4 * sx, 1.6 * sy, C.jellySh);

  // 활짝 웃는 얼굴 (엔딩에서 다 같이 축하할 때)
  if (o.happy) {
    for (const d of [-1, 1]) {
      const bx = d * 3.3 * sx, by = -7.8 * sy;
      c.fillStyle = '#1d3512';
      c.fillRect(Math.round(bx - 3), Math.round(by + 1), 1, 1);
      c.fillRect(Math.round(bx - 2), Math.round(by), 1, 1);
      c.fillRect(Math.round(bx - 1), Math.round(by - 1), 2, 1);
      c.fillRect(Math.round(bx + 1), Math.round(by), 1, 1);
      c.fillRect(Math.round(bx + 2), Math.round(by + 1), 1, 1);
      ell(c, bx, by + 3.6, 2, 1.2, 'rgba(255,140,170,0.5)');    // 볼 홍조
    }
    c.fillStyle = '#1d3512';
    c.fillRect(-2, Math.round(-3.6 * sy), 4, 1);
    ell(c, 0, -2.6 * sy, 2.2, 1.6, '#1d3512');
    ell(c, 0, -2.2 * sy, 1.4, 0.9, '#ff9dc0');
    c.restore();
    return;
  }

  // 눈 - 스톤처럼 흰자 / 홍채 / 눈동자 / 반짝임까지 넣어 악당이어도 귀엽게
  const eo = o.angry ? 0.6 : 0;
  for (const d of [-1, 1]) {
    const bx = d * 3.3 * sx, by = -7.8 * sy;
    const ix = bx + d * 0.3, iy = by + 0.45 + eo * 0.4;
    ellOut(c, bx, by, 2.6, 3.1, C.white, out);
    ell(c, bx, by + 1.4, 2.1, 1.1, '#e0f2d6');      // 아래쪽 옅은 반사
    ell(c, ix, iy, 1.7, 1.9, '#2f6b22');            // 홍채 (초록)
    ell(c, ix, iy + 0.8, 1.35, 0.85, '#57a52f');    // 홍채 아랫쪽 밝게
    ell(c, ix, iy, 0.9, 1.1, '#141f0d');            // 눈동자
    px(c, ix - 1.1, iy - 1.2, C.white, 2, 2);       // 큰 반짝임
    px(c, ix + 0.8, iy + 0.8, C.white);             // 작은 반짝임
    if (o.angry) { c.fillStyle = out; c.fillRect(Math.round(bx - 2.6), Math.round(by - 4.2), 5, 1); }
  }
  // 방울 입
  px(c, 0, -4 * sy, '#2e5c1e', 2, 1);

  c.restore();
}

/** 삐로디가 터질 때 튀는 젤리 방울 */
export function drawBlob(c, x, y, r, alpha) {
  c.save();
  c.globalAlpha = alpha;
  ell(c, x, y, r + 0.8, r + 0.8, C.jOut);
  ell(c, x, y, r, r, C.jelly);
  c.restore();
}

// ---------------------------------------------------------------- 배경 오브젝트

export function drawTree(c, x, y, seed = 0, t = 0) {
  const sway = Math.sin(t * 1.1 + seed) * 1.2;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  ell(c, 0, -1, 8, 3, 'rgba(20,45,15,0.25)');
  // 줄기 (예전 6px 에서 8px 로 살짝 두껍게)
  c.fillStyle = C.trunk; c.fillRect(-4, -20, 8, 20);
  c.fillStyle = C.trunkSh; c.fillRect(1, -20, 3, 20);
  c.fillStyle = '#3f2a12'; c.fillRect(-4, -20, 1, 20);
  c.fillStyle = '#9a5f2e'; c.fillRect(-2, -18, 1, 15);   // 결 무늬
  // 잎 (그림처럼 세 덩어리)
  ellOut(c, -6 + sway, -25, 6.5, 7, C.leaf, C.leafSh);
  ellOut(c, 6 + sway, -24, 6.5, 7, C.leaf, C.leafSh);
  ellOut(c, 0 + sway, -32, 7, 8, C.leaf, C.leafSh);
  ell(c, -4 + sway, -30, 3, 2.6, C.leafHi);
  ell(c, 4 + sway, -25, 2.4, 2, C.leafHi);
  c.restore();
}

// ---------------------------------------------------------------- 핵폭탄
//
// 아이 그림(assets/핵폭탄.jpg)대로 검은 미사일 몸통에 흰 동그라미,
// 그 안에 노란 번개 표시, 아래쪽에 꼬리 날개를 그렸습니다.
// s 는 배율입니다. s=1 이면 대략 가로 12 x 세로 22 픽셀.

export function drawBomb(c, x, y, s = 1, opts = {}) {
  const R = (ax, ay, aw, ah, col) => {
    c.fillStyle = col;
    c.fillRect(Math.round(x + ax * s), Math.round(y + ay * s),
      Math.max(1, Math.round(aw * s)), Math.max(1, Math.round(ah * s)));
  };
  const dim = opts.dim;
  const BK = dim ? '#4a4a52' : '#191920';
  const BK2 = dim ? '#6a6a74' : '#3d3d48';
  const W = dim ? '#9a9aa2' : '#ffffff';
  const Y = dim ? '#8f8a5c' : '#f5c518';

  // 꼬리 날개
  R(-7, -8, 2, 8, BK); R(5, -8, 2, 8, BK);
  R(-6, -1, 12, 2, BK);
  // 몸통 (위로 갈수록 둥글게)
  R(-5, -20, 10, 20, BK);
  R(-4, -22, 8, 2, BK);
  R(-3, -23, 6, 1, BK);
  R(-2, -24, 4, 1, BK);
  // 왼쪽 광택
  R(-5, -19, 1, 14, BK2);
  R(-4, -19, 1, 4, BK2);

  // 흰 원판 안에 노란 방사능 표시
  drawTrefoil(c, x, y - 12 * s, 4.6, s, W, Y, BK);

  if (opts.glow) R(-2, -21, 4, 1, '#fff9b0');
}

/**
 * 방사능 표시 (assets/image.png 참고).
 * 바깥 한 겹은 흰 테두리, 안쪽은 노란 바탕에 120도 간격으로 검은 날개 세 개와 가운데 점.
 */
function drawTrefoil(c, cx, cy, r, s, white, yellow, dark) {
  const cell = Math.max(1, Math.round(s));
  const put = (dx, dy, col) => {
    c.fillStyle = col;
    c.fillRect(Math.round(cx + dx * s), Math.round(cy + dy * s), cell, cell);
  };
  const ri = Math.ceil(r);
  const inner = r - 1.1;                 // 흰 테두리 안쪽 반지름
  for (let dy = -ri; dy <= ri; dy++) {
    for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      if (d > inner) { put(dx, dy, white); continue; }

      let col = yellow;
      if (d <= inner * 0.3) {
        col = dark;                      // 가운데 검은 점
      } else if (d > inner * 0.42) {
        let a = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (a < 0) a += 360;
        for (const b of [90, 210, 330]) {    // 날개 세 개
          let diff = Math.abs(a - b);
          if (diff > 180) diff = 360 - diff;
          if (diff <= 30) { col = dark; break; }
        }
      }
      put(dx, dy, col);
    }
  }
}

/** 하늘에서 떨어지는 핵폭탄 (떨어질 위치 표시 + 낙하) */
export function drawIncomingNuke(c, x, y, p, radius = 48) {
  // p: 0 -> 1 (경고 시작부터 터지기까지)
  //
  // 조준 원 = 폭발 그림 = 실제 데미지 범위. 셋을 완전히 같은 정원으로 맞췄습니다.
  // (예전에는 조준 원이 처음에 1.25배로 부풀었고, y 를 0.8배 눌러 타원으로 그려서
  //  눈에 보이는 범위와 실제로 맞는 범위가 달랐습니다)
  const pulse = 0.45 + 0.55 * Math.abs(Math.sin(p * Math.PI * 7));
  c.save();
  c.globalAlpha = pulse;
  const r = radius;
  for (let i = 0; i < 48; i++) {                      // 붉은 점선 원
    if (i % 3 === 0) continue;
    const a = (i / 48) * Math.PI * 2 + p * 3;
    px(c, x + Math.cos(a) * r, y + Math.sin(a) * r, '#ff3b3b', 2, 2);
  }
  c.fillStyle = '#ff3b3b';
  const k = Math.round(r * 0.3);
  c.fillRect(Math.round(x - k - 6), Math.round(y), 6, 1);
  c.fillRect(Math.round(x + k), Math.round(y), 6, 1);
  c.fillRect(Math.round(x), Math.round(y - k - 6), 1, 6);
  c.fillRect(Math.round(x), Math.round(y + k), 1, 6);
  c.globalAlpha = 0.22 * pulse;
  ell(c, x, y, r, r, '#ff3b3b');
  c.restore();

  // 하늘에서 내려오는 폭탄 (뒤쪽 절반 동안만 보입니다)
  if (p > 0.35) {
    const q = (p - 0.35) / 0.65;
    const by = y - 150 * (1 - q);
    c.save();
    c.globalAlpha = 0.35;
    c.fillStyle = '#ffffff';
    c.fillRect(Math.round(x), Math.round(by), 1, Math.round(26 * (1 - q) + 4));
    c.restore();
    drawBomb(c, x, by, 1, { glow: true });
  }
}

/**
 * 핵폭발. t 는 0 -> 1.
 * 섬광 → 불덩이 → 충격파 고리 → 버섯구름 → 그을음 순서로 짧게 지나갑니다.
 */
export function drawNukeBlast(c, x, y, r, t) {
  c.save();

  // 1) 바닥 그을음 - 정확히 데미지 반경만큼
  c.globalAlpha = Math.max(0, 0.55 - t * 0.45);
  ell(c, x, y, r, r, '#3a2a22');
  ell(c, x, y, r * 0.68, r * 0.68, '#241812');

  // 2) 충격파 고리 - 가운데에서 퍼져나가 데미지 반경에서 정확히 멈춥니다
  const ring = Math.min(1, t / 0.55);
  if (ring < 1) {
    const rr = r * (0.25 + ring * 0.75);
    c.globalAlpha = (1 - ring) * 0.85;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      px(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr, '#ffffff', 2, 2);
      px(c, x + Math.cos(a) * rr * 0.93, y + Math.sin(a) * rr * 0.93, '#ffd36b', 2, 2);
    }
  }

  // 3) 불덩이 (커졌다가 사그라듦) - 최대 크기가 데미지 반경과 같습니다
  const fb = t < 0.18 ? t / 0.18 : Math.max(0, 1 - (t - 0.18) / 0.5);
  if (fb > 0) {
    const fr = r * (0.3 + fb * 0.7);
    c.globalAlpha = Math.min(1, fb * 1.3);
    ell(c, x, y, fr, fr, '#ff5a1e');
    ell(c, x, y, fr * 0.72, fr * 0.72, '#ffaa2b');
    ell(c, x, y, fr * 0.42, fr * 0.42, '#fff3b0');
  }

  // 4) 버섯구름
  if (t > 0.14) {
    const q = Math.min(1, (t - 0.14) / 0.7);
    c.globalAlpha = Math.max(0, 1 - q) * 0.95;
    const stemH = r * 1.5 * q;
    const sw = r * 0.26;
    // 기둥
    ell(c, x, y - stemH * 0.5, sw, stemH * 0.5, '#8a7060');
    ell(c, x - sw * 0.3, y - stemH * 0.5, sw * 0.45, stemH * 0.45, '#a89080');
    // 갓
    const capY = y - stemH - r * 0.25;
    const cw = r * (0.45 + q * 0.55);
    ell(c, x, capY, cw, cw * 0.52, '#9a8070');
    ell(c, x - cw * 0.35, capY - cw * 0.2, cw * 0.42, cw * 0.3, '#c0a898');
    ell(c, x + cw * 0.4, capY + cw * 0.1, cw * 0.34, cw * 0.24, '#7a6254');
    if (q < 0.55) {
      c.globalAlpha = (1 - q / 0.55) * 0.8;
      ell(c, x, capY, cw * 0.55, cw * 0.32, '#ffbe5a');
    }
  }

  // 5) 처음 0.12초 동안 눈부신 섬광
  if (t < 0.12) {
    const q = t / 0.12;
    c.globalAlpha = 1 - q;
    ell(c, x, y, r * (0.3 + q * 0.7), r * (0.3 + q * 0.7), '#ffffff');
  }

  // 6) 사방으로 튀는 불똥
  c.globalAlpha = Math.max(0, 1 - t * 1.2);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + i * 0.7;
    const d = Math.min(r, r * (0.3 + t * 1.1) * (0.7 + ((i * 31) % 10) / 18));
    px(c, x + Math.cos(a) * d, y + Math.sin(a) * d,
      i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ffd36b' : '#ff7a3c', 2, 2);
  }

  c.restore();
}

/** 강물이 지도 밖으로 흘러나가는 자리에 서 있는 갈대 */
export function drawReed(c, x, y, seed = 0, t = 0) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * 3.4;
    const h = 13 + ((i * 7 + seed * 3) % 6);
    const sway = Math.sin(t * 1.8 + seed + i * 0.7) * 1.6;
    c.fillStyle = '#2f7a2b';
    for (let k = 0; k < h; k++) {
      const bend = (k / h) * (k / h) * sway;
      c.fillRect(Math.round(off + bend), -k, 1, 1);
    }
    // 갈색 이삭
    c.fillStyle = '#7d4a24';
    c.fillRect(Math.round(off + sway), -h - 3, 1, 4);
    c.fillStyle = '#9a5f2e';
    c.fillRect(Math.round(off + sway), -h - 3, 1, 2);
  }
  c.restore();
}

/** 나무 사이 좁은 틈을 막는 덤불. 지나갈 수 없다는 걸 눈으로 알 수 있게 해줍니다. */
export function drawBush(c, x, y, seed = 0, t = 0) {
  const sway = Math.sin(t * 1.4 + seed) * 0.8;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  ell(c, 0, -1, 8, 2.8, 'rgba(20,45,15,0.25)');
  ellOut(c, -4 + sway, -6, 5, 5, C.leaf, C.leafSh);
  ellOut(c, 4 + sway, -5.5, 5.2, 5.2, C.leaf, C.leafSh);
  ellOut(c, 0 + sway, -10, 5.4, 5, C.leaf, C.leafSh);
  ell(c, -3 + sway, -9, 2.4, 1.8, C.leafHi);
  ell(c, 3 + sway, -4.5, 2, 1.4, C.leafHi);
  // 열매 몇 알
  px(c, -5 + sway, -8, '#ff6b6b'); px(c, 5 + sway, -9, '#ff6b6b'); px(c, 1 + sway, -3, '#ff6b6b');
  c.restore();
}

export function drawHouse(c, x, y) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  ell(c, 0, -1, 22, 4, 'rgba(20,45,15,0.25)');
  // 주황 벽
  c.fillStyle = C.wall; c.fillRect(-15, -30, 30, 30);
  c.fillStyle = C.wallSh; c.fillRect(9, -30, 6, 30);
  c.fillStyle = '#4a2a10'; c.fillRect(-16, -31, 32, 1); c.fillRect(-16, -31, 1, 32); c.fillRect(15, -31, 1, 32);
  // 창문
  c.fillStyle = '#4a2a10'; c.fillRect(-7, -24, 13, 13);
  c.fillStyle = C.win; c.fillRect(-6, -23, 11, 11);
  c.fillStyle = '#4a2a10'; c.fillRect(-1, -23, 1, 11); c.fillRect(-6, -18, 11, 1);
  // 갈색 삼각 지붕
  tri(c, 0, -56, 23, 26, C.roof);
  c.fillStyle = C.roofSh;
  for (let i = 0; i < 26; i++) {
    const w = Math.round(23 * (i / 26));
    c.fillRect(Math.round(w * 0.35), -56 + i, Math.max(1, Math.round(w * 0.65)), 1);
  }
  c.fillStyle = '#3d1c0e'; c.fillRect(-24, -31, 48, 2);
  c.restore();
}

// ---------------------------------------------------------------- 인트로용 하늘

export function drawSun(c, x, y, t) {
  const r = 13 + Math.sin(t * 1.3) * 0.6;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 0.25;
    const l0 = r + 3, l1 = r + 8 + Math.sin(t * 2 + i) * 2;
    c.strokeStyle = C.sun; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(Math.round(Math.cos(a) * l0), Math.round(Math.sin(a) * l0));
    c.lineTo(Math.round(Math.cos(a) * l1), Math.round(Math.sin(a) * l1));
    c.stroke();
  }
  ell(c, 0, 0, r, r, '#e8a815');
  ell(c, 0, 0, r - 1.2, r - 1.2, C.sun);
  ell(c, -r * 0.3, -r * 0.3, r * 0.4, r * 0.35, C.sunHi);
  c.restore();
}

export function drawCloud(c, x, y, s) {
  ell(c, x, y, 11 * s, 6 * s, '#ffffff');
  ell(c, x - 9 * s, y + 2 * s, 7 * s, 4.5 * s, '#ffffff');
  ell(c, x + 9 * s, y + 2 * s, 8 * s, 5 * s, '#ffffff');
  ell(c, x + 1 * s, y - 4 * s, 7 * s, 5 * s, '#ffffff');
  ell(c, x - 2 * s, y + 4 * s, 12 * s, 3 * s, '#dcecf8');
}
