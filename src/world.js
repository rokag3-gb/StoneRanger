// 지도 - 잔디, 시냇물, 나무, 집을 만들고 충돌과 화면 그리기를 담당합니다.

import { CFG } from './config.js';
import { C, ell, px, drawTree, drawBush, drawReed, drawHouse, drawStone, drawPirodi, drawBlob, dotNum,
  drawIncomingNuke, drawNukeBlast } from './sprites.js';

const T = CFG.TILE;
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));

// 꽃 색깔 [꽃잎, 꽃잎 그늘]
export const FLOWER_COLORS = [
  ['#ffffff', '#d8e4ee'],   // 하양
  ['#ff9ecb', '#e87f9f'],   // 분홍
  ['#ffe45c', '#e8c62f'],   // 노랑
  ['#b79bff', '#8f73e0'],   // 보라
  ['#ff9a6b', '#e07444'],   // 주황
  ['#8fd8ff', '#5fb0e0'],   // 하늘
];

/** 줄기 + 잎 + 다섯 장 꽃잎. (x, y) 는 꽃송이 한가운데 */
export function drawFlower(g, x, y, idx) {
  const [petal, shade] = FLOWER_COLORS[idx % FLOWER_COLORS.length];
  // 줄기
  g.fillStyle = '#3f8f26';
  g.fillRect(x, y + 2, 1, 4);
  g.fillRect(x - 1, y + 4, 1, 1);
  g.fillRect(x + 1, y + 3, 1, 1);
  // 꽃잎
  g.fillStyle = petal;
  g.fillRect(x - 1, y - 2, 3, 1);
  g.fillRect(x - 2, y - 1, 5, 1);
  g.fillRect(x - 1, y, 3, 1);
  // 아래쪽 그늘
  g.fillStyle = shade;
  g.fillRect(x - 1, y + 1, 3, 1);
  g.fillRect(x + 2, y, 1, 1);
  // 꽃술
  g.fillStyle = '#ffd34d';
  g.fillRect(x, y - 1, 1, 1);
}

export class World {
  /** opts: { w, h, trees, houses } - 스테이지마다 지도 크기가 다릅니다 */
  constructor(opts = {}) {
    this.w = opts.w || CFG.MAP_W;
    this.h = opts.h || CFG.MAP_H;
    const area = this.w * this.h;
    this.treeCount = opts.trees ?? Math.round(area * CFG.TREE_DENSITY);
    this.houseCount = opts.houses ?? Math.max(2, Math.round(area * CFG.HOUSE_DENSITY));
    this.pw = this.w * T;
    this.ph = this.h * T;
    this.water = new Uint8Array(this.w * this.h);
    this.solid = new Uint8Array(this.w * this.h);
    this.decor = new Uint8Array(this.w * this.h);   // 0 없음 / 1 풀포기 / 2 꽃
    this.objects = [];
    this.generate();
    this.ground = this.bake();
  }

  i(tx, ty) { return ty * this.w + tx; }
  inB(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }

  isSolidTile(tx, ty) { return !this.inB(tx, ty) || this.solid[this.i(tx, ty)] === 1; }
  isWaterTile(tx, ty) { return this.inB(tx, ty) && this.water[this.i(tx, ty)] === 1; }
  isWaterAt(x, y) { return this.isWaterTile(Math.floor(x / T), Math.floor(y / T)); }

  // -------------------------------------------------------------- 생성

  generate() {
    // 1) 바깥 테두리는 지나갈 수 없게
    for (let tx = 0; tx < this.w; tx++) {
      this.solid[this.i(tx, 0)] = 1;
      this.solid[this.i(tx, this.h - 1)] = 1;
    }
    for (let ty = 0; ty < this.h; ty++) {
      this.solid[this.i(0, ty)] = 1;
      this.solid[this.i(this.w - 1, ty)] = 1;
    }

    // 2) 시냇물 - 방향도 폭도 매번 다르게 흐릅니다
    this.carveRiver();

    // 3) 스톤이 시작할 자리를 정합니다.
    // 강이 한가운데를 지나갈 수도 있어서, 가운데에서 가장 가까운 마른 땅을 찾습니다.
    const sp = this.findSpawnTile();
    const cx = sp.tx, cy = sp.ty;
    this.spawn = { x: cx * T + T / 2, y: cy * T + T / 2 };
    const clear = (tx, ty) => Math.abs(tx - cx) < 7 && Math.abs(ty - cy) < 5;

    // 4) 나무
    const placed = [];
    for (let n = 0; n < this.treeCount * 14 && placed.length < this.treeCount; n++) {
      const tx = ri(2, this.w - 3), ty = ri(3, this.h - 3);
      if (this.water[this.i(tx, ty)] || this.solid[this.i(tx, ty)] || clear(tx, ty)) continue;
      // 나무끼리 충분히 떨어뜨립니다. 붙어 있으면 그 사이 한 칸에 캐릭터가 낑깁니다.
      const gap = CFG.TREE_GAP;
      if (placed.some((p) => Math.abs(p[0] - tx) < gap && Math.abs(p[1] - ty) < gap)) continue;
      placed.push([tx, ty]);
      this.solid[this.i(tx, ty)] = 1;
      this.objects.push({ type: 'tree', x: tx * T + T / 2, y: ty * T + T, seed: Math.random() * 6.28 });
    }

    // 5) 테두리를 따라 나무 울타리.
    // 예전엔 두 칸에 하나씩만 심어서 나무와 나무 사이에 한 칸짜리 구멍이 생겼고,
    // 거기에 삐로디가 들어가 낑겨버렸습니다. 이제 빈틈 없이 한 칸마다 심습니다.
    // 강물 위에는 나무를 세우지 않습니다. 강은 지도 밖으로 흘러나가는 것처럼 보이고,
    // 어차피 바깥 한 줄이 막혀 있어서 캐릭터가 지도를 벗어날 일은 없습니다.
    const fence = (tx, ty) => {
      this.solid[this.i(tx, ty)] = 1;
      if (this.water[this.i(tx, ty)]) {
        this.objects.push({ type: 'reed', x: tx * T + T / 2, y: ty * T + T, seed: Math.random() * 6.28 });
      } else {
        this.objects.push({ type: 'tree', x: tx * T + T / 2, y: ty * T + T, seed: Math.random() * 6.28 });
      }
    };
    for (let tx = 1; tx < this.w - 1; tx++) { fence(tx, 1); fence(tx, this.h - 2); }
    for (let ty = 2; ty < this.h - 2; ty++) { fence(1, ty); fence(this.w - 2, ty); }

    // 6) 집 (가로 3칸 x 세로 2칸을 차지)
    let houses = 0;
    for (let n = 0; n < 600 && houses < this.houseCount; n++) {
      const tx = ri(4, this.w - 6), ty = ri(5, this.h - 5);
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx++) {
        for (let dy = -1; dy <= 0 && ok; dy++) {
          const a = tx + dx, b = ty + dy;
          if (!this.inB(a, b) || this.water[this.i(a, b)] || this.solid[this.i(a, b)] || clear(a, b)) ok = false;
        }
      }
      if (!ok) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 0; dy++) this.solid[this.i(tx + dx, ty + dy)] = 1;
      this.objects.push({ type: 'house', x: tx * T + T / 2, y: ty * T + T });
      houses++;
    }

    // 7) 풀포기와 꽃
    for (let ty = 1; ty < this.h - 1; ty++) {
      for (let tx = 1; tx < this.w - 1; tx++) {
        if (this.water[this.i(tx, ty)] || this.solid[this.i(tx, ty)]) continue;
        const r = Math.random();
        if (r < CFG.FLOWER_CHANCE) this.decor[this.i(tx, ty)] = 2;
        else if (r < 0.30) this.decor[this.i(tx, ty)] = 1;
      }
    }

    // 8) 한 칸짜리 좁은 틈 메우기.
    // 캐릭터 발밑 판정이 12px 인데 한 칸은 16px 이라 겨우 지나가면서 덜컥거립니다.
    // 그런 자리는 덤불로 막아서 아예 못 들어가게 합니다.
    this.sealNarrowGaps(clear);

    // 9) 스톤이 실제로 걸어갈 수 있는 칸을 미리 계산합니다.
    // 이래야 삐로디가 막힌 구석에 생겨서 스테이지가 안 끝나는 일이 없습니다.
    this.computeReachable();
  }

  /**
   * 시냇물 파기.
   * 가로/세로 중 하나를 골라 기울기·구불거림·폭을 매번 새로 뽑습니다.
   * 그래서 게임을 다시 하거나 스테이지가 바뀔 때마다 강 모양이 달라집니다.
   */
  carveRiver() {
    const vertical = Math.random() < 0.5;
    const along = vertical ? this.h : this.w;     // 강이 흐르는 방향의 길이
    const across = vertical ? this.w : this.h;    // 강을 가로지르는 방향의 길이

    // 한가운데(스톤이 시작하는 곳)를 피해 한쪽으로 치우쳐 흐르게 합니다
    const side = Math.random() < 0.5 ? -1 : 1;
    const base = across * (0.5 + side * rnd(0.14, 0.3));

    const drift = rnd(-0.25, 0.25);               // 기울기 (대각선으로 흐르게)
    const amp = across * rnd(0.04, 0.12);         // 크게 구불거리는 정도
    const freq = rnd(0.05, 0.13);
    const amp2 = rnd(1.5, 4.0);                   // 잘게 구불거리는 정도
    const freq2 = rnd(0.15, 0.3);
    const phase = rnd(0, Math.PI * 2);
    const halfBase = rnd(1.3, 2.6);               // 강폭
    const halfVary = rnd(0.3, 1.1);

    for (let i = 0; i < along; i++) {
      const c = base
        + drift * (i - along / 2)
        + Math.sin(i * freq + phase) * amp
        + Math.sin(i * freq2 + phase * 2) * amp2;
      const half = Math.max(1, halfBase + Math.sin(i * 0.13 + phase) * halfVary);
      for (let j = Math.floor(c - half); j <= Math.ceil(c + half); j++) {
        const tx = vertical ? j : i;
        const ty = vertical ? i : j;
        if (this.inB(tx, ty) && !this.isSolidTile(tx, ty)) this.water[this.i(tx, ty)] = 1;
      }
    }
    this.riverVertical = vertical;
  }

  /** 지도 한가운데에서 가장 가까운 "마른 땅"을 찾습니다 (강 위에서 시작하지 않도록) */
  findSpawnTile() {
    const cx = (this.w / 2) | 0, cy = (this.h / 2) | 0;
    const limit = Math.max(this.w, this.h);
    for (let r = 0; r < limit; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = cx + dx, ty = cy + dy;
          if (tx < 3 || ty < 3 || tx >= this.w - 3 || ty >= this.h - 3) continue;
          const k = this.i(tx, ty);
          if (this.solid[k] || this.water[k]) continue;
          return { tx, ty };
        }
      }
    }
    return { tx: cx, ty: cy };
  }

  /**
   * 양옆(또는 위아래)이 막힌 한 칸짜리 틈을 덤불로 메웁니다.
   * 덤불을 놓으면 그 옆에 또 새로운 한 칸 틈이 생길 수 있어서, 더 나올 게 없을 때까지 반복합니다.
   */
  sealNarrowGaps(inSpawnArea) {
    for (let pass = 0; pass < 8; pass++) {
      const seal = [];
      for (let ty = 2; ty < this.h - 2; ty++) {
        for (let tx = 2; tx < this.w - 2; tx++) {
          const k = this.i(tx, ty);
          if (this.solid[k] || this.water[k]) continue;
          if (inSpawnArea(tx, ty)) continue;
          const l = this.isSolidTile(tx - 1, ty), r = this.isSolidTile(tx + 1, ty);
          const u = this.isSolidTile(tx, ty - 1), d = this.isSolidTile(tx, ty + 1);
          if ((l && r) || (u && d)) seal.push([tx, ty, k]);
        }
      }
      if (!seal.length) break;
      for (const [tx, ty, k] of seal) {
        this.solid[k] = 1;
        // 보이지 않는 벽은 답답하니 눈에 보이는 덤불을 놓습니다
        this.objects.push({ type: 'bush', x: tx * T + T / 2, y: ty * T + T, seed: Math.random() * 6.28 });
      }
    }
  }

  /** 시작 지점에서 걸어서 닿을 수 있는 칸을 표시합니다 (상하좌우로만 이동) */
  computeReachable() {
    const seen = new Uint8Array(this.w * this.h);
    const sx = Math.floor(this.spawn.x / T), sy = Math.floor(this.spawn.y / T);
    const stack = [[sx, sy]];
    seen[this.i(sx, sy)] = 1;
    while (stack.length) {
      const [tx, ty] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (!this.inB(nx, ny)) continue;
        const k = this.i(nx, ny);
        if (seen[k] || this.solid[k]) continue;
        seen[k] = 1;
        stack.push([nx, ny]);
      }
    }
    this.reachable = seen;
  }

  // -------------------------------------------------------------- 바닥 굽기
  // 지도 전체를 한 번만 그려두고 매 프레임 통째로 붙입니다.

  bake() {
    const cv = document.createElement('canvas');
    cv.width = this.pw; cv.height = this.ph;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;

    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const X = tx * T, Y = ty * T;
        if (this.water[this.i(tx, ty)]) {
          g.fillStyle = C.water; g.fillRect(X, Y, T, T);
          g.fillStyle = C.waterDeep;
          for (let k = 0; k < 3; k++) {
            const a = ((tx * 7 + ty * 13 + k * 29) % 13);
            g.fillRect(X + a, Y + ((tx * 5 + ty * 3 + k * 7) % T), 3, 1);
          }
          g.fillStyle = C.waterHi;
          const b = (tx * 3 + ty * 11) % (T - 4);
          g.fillRect(X + b, Y + ((tx + ty * 5) % T), 4, 1);
          // 물가 모래
          const land = !this.isWaterTile(tx - 1, ty) || !this.isWaterTile(tx + 1, ty)
            || !this.isWaterTile(tx, ty - 1) || !this.isWaterTile(tx, ty + 1);
          if (land) {
            g.fillStyle = C.sand;
            if (!this.isWaterTile(tx - 1, ty)) g.fillRect(X, Y, 2, T);
            if (!this.isWaterTile(tx + 1, ty)) g.fillRect(X + T - 2, Y, 2, T);
            if (!this.isWaterTile(tx, ty - 1)) g.fillRect(X, Y, T, 2);
            if (!this.isWaterTile(tx, ty + 1)) g.fillRect(X, Y + T - 2, T, 2);
          }
          continue;
        }

        // 잔디
        g.fillStyle = C.grass[(tx * 3 + ty * 7) % 3];
        g.fillRect(X, Y, T, T);
        // 크레용 그림처럼 세로로 긁힌 결
        g.fillStyle = C.grassDark;
        for (let k = 0; k < 3; k++) {
          const a = (tx * 5 + ty * 11 + k * 17) % T;
          const b = (tx * 13 + ty * 3 + k * 23) % (T - 3);
          g.fillRect(X + a, Y + b, 1, 3);
        }
        const d = this.decor[this.i(tx, ty)];
        if (d === 1) {
          g.fillStyle = '#3f8f26';
          const a = (tx * 7 + ty * 5) % (T - 5) + 2;
          const b = (tx * 11 + ty * 13) % (T - 6) + 3;
          g.fillRect(X + a, Y + b, 1, 4); g.fillRect(X + a + 2, Y + b + 1, 1, 3); g.fillRect(X + a - 2, Y + b + 1, 1, 3);
        } else if (d === 2) {
          const a = (tx * 7 + ty * 5) % (T - 7) + 3;
          const b = (tx * 11 + ty * 13) % (T - 8) + 4;
          drawFlower(g, X + a, Y + b, (tx * 3 + ty * 5) % FLOWER_COLORS.length);
        }
      }
    }
    return cv;
  }

  // -------------------------------------------------------------- 충돌
  // 발밑 사각형(hw x hh)만 타일과 부딪힙니다. X축과 Y축을 따로 처리해서
  // 벽에 비스듬히 부딪혀도 자연스럽게 미끄러집니다.

  boxBlocked(x, y, hw, hh) {
    const x0 = Math.floor((x - hw) / T), x1 = Math.floor((x + hw - 0.01) / T);
    const y0 = Math.floor((y - hh) / T), y1 = Math.floor((y + hh - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (this.isSolidTile(tx, ty)) return true;
    }
    return false;
  }

  /**
   * 벽 안에 갇힌 엔티티를 가장 가까운 빈 자리로 밀어냅니다.
   * 넉백으로 나무 속에 처박히면 어느 방향으로도 못 움직여 영영 갇히기 때문에 필요합니다.
   */
  unstick(e, hw, hh) {
    if (!this.boxBlocked(e.x, e.y - hh, hw, hh)) return false;
    for (let r = 2; r <= 64; r += 2) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const nx = e.x + Math.cos(a) * r;
        const ny = e.y + Math.sin(a) * r;
        if (nx < T || ny < T || nx > this.pw - T || ny > this.ph - T) continue;
        if (!this.boxBlocked(nx, ny - hh, hw, hh)) { e.x = nx; e.y = ny; return true; }
      }
    }
    return false;
  }

  /** 엔티티를 dx,dy 만큼 밀어줍니다. */
  move(e, dx, dy, hw = 6, hh = 4) {
    this.unstick(e, hw, hh);
    const fy = () => e.y - hh;   // 발밑 박스의 중심 y
    if (dx !== 0) {
      const nx = e.x + dx;
      if (!this.boxBlocked(nx, fy(), hw, hh)) e.x = nx;
      else {
        // 한 픽셀씩이라도 붙여봅니다
        const step = Math.sign(dx);
        for (let i = 0; i < Math.abs(dx); i++) {
          if (this.boxBlocked(e.x + step, fy(), hw, hh)) break;
          e.x += step;
        }
      }
    }
    if (dy !== 0) {
      const ny = e.y + dy;
      if (!this.boxBlocked(e.x, ny - hh, hw, hh)) e.y = ny;
      else {
        const step = Math.sign(dy);
        for (let i = 0; i < Math.abs(dy); i++) {
          if (this.boxBlocked(e.x, e.y + step - hh, hw, hh)) break;
          e.y += step;
        }
      }
    }
    e.x = Math.max(T, Math.min(this.pw - T, e.x));
    e.y = Math.max(T, Math.min(this.ph - T, e.y));
  }

  /** 지나갈 수 있는 빈 땅을 랜덤으로 찾습니다 (물 제외) */
  randomOpen(minDistFrom = null, minDist = 0) {
    for (let n = 0; n < 800; n++) {
      const tx = ri(3, this.w - 4), ty = ri(4, this.h - 4);
      const k = this.i(tx, ty);
      if (this.solid[k] || this.water[k]) continue;
      // 스톤이 걸어서 갈 수 없는 구석이면 거기엔 안 놓습니다
      if (this.reachable && !this.reachable[k]) continue;
      const x = tx * T + T / 2, y = ty * T + T / 2;
      if (minDistFrom) {
        const d = Math.hypot(x - minDistFrom.x, y - minDistFrom.y);
        if (d < minDist) continue;
      }
      return { x, y };
    }
    return { x: this.spawn.x + rnd(-60, 60), y: this.spawn.y + rnd(-60, 60) };
  }
}

// ---------------------------------------------------------------- 필드 그리기
//
// cam: { x, y, zoom }   view: { vw, vh }

export function renderField(c, world, cam, vw, vh, state, t) {
  const z = cam.zoom || 1;

  c.save();
  c.translate(Math.round(vw / 2), Math.round(vh / 2));
  c.scale(z, z);
  c.translate(-Math.round(cam.x), -Math.round(cam.y));

  // 바닥
  c.drawImage(world.ground, 0, 0);

  // 물결 반짝임 (화면에 보이는 곳만)
  const left = cam.x - vw / (2 * z), right = cam.x + vw / (2 * z);
  const top = cam.y - vh / (2 * z), bottom = cam.y + vh / (2 * z);
  const tx0 = Math.max(0, Math.floor(left / T)), tx1 = Math.min(world.w - 1, Math.ceil(right / T));
  const ty0 = Math.max(0, Math.floor(top / T)), ty1 = Math.min(world.h - 1, Math.ceil(bottom / T));
  c.fillStyle = C.waterHi;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!world.water[world.i(tx, ty)]) continue;
      const ph = (tx * 0.7 + ty * 0.4 + t * 1.6);
      const o = Math.sin(ph);
      if (o > 0.55) c.fillRect(tx * T + ((tx * 5 + ty * 3) % 10), ty * T + ((tx + ty * 7) % 12), 3, 1);
    }
  }

  // 앞뒤 순서대로 (y 값이 작을수록 뒤)
  const draw = [];
  for (const o of world.objects) {
    if (o.x < left - 48 || o.x > right + 48 || o.y < top - 70 || o.y > bottom + 48) continue;
    draw.push(o);
  }
  if (state) {
    for (const p of state.pirodis) draw.push({ type: 'pirodi', x: p.x, y: p.y, ref: p });
    if (state.boss) draw.push({ type: 'boss', x: state.boss.x, y: state.boss.y, ref: state.boss });
    if (state.stone && !state.stone.hidden) draw.push({ type: 'stone', x: state.stone.x, y: state.stone.y, ref: state.stone });
  }
  draw.sort((a, b) => a.y - b.y);

  for (const o of draw) {
    switch (o.type) {
      case 'tree': drawTree(c, o.x, o.y, o.seed, t); break;
      case 'bush': drawBush(c, o.x, o.y, o.seed, t); break;
      case 'reed': drawReed(c, o.x, o.y, o.seed, t); break;
      case 'house': drawHouse(c, o.x, o.y); break;
      case 'pirodi': o.ref.draw(c, t); break;
      case 'boss': o.ref.draw(c, t); break;
      case 'stone': o.ref.draw(c, t); break;
    }
  }

  // 파티클과 이펙트
  if (state) {
    for (const p of state.particles) {
      drawBlob(c, p.x, p.y, p.r, Math.max(0, p.life / p.max));
    }
    for (const f of state.hitFx) drawHitFx(c, f);

    // 핵폭탄 - 떨어질 자리 표시와 폭발
    if (state.nuke) drawIncomingNuke(c, state.nuke.x, state.nuke.y, state.nuke.t / state.nuke.delay, state.nuke.r);
    if (state.blasts) {
      for (const b of state.blasts) drawNukeBlast(c, b.x, b.y, b.r, b.t / b.max);
    }
    for (const s of state.scorePops) {
      const a = Math.max(0, s.life / s.max);
      c.save(); c.globalAlpha = a;
      dotNum(c, s.text, s.x, s.y - (1 - a) * 14, s.color || '#fff27a');
      c.restore();
    }
    if (state.boss) state.boss.drawHpBar(c);
    if (state.stone && !state.stone.hidden) state.stone.drawEnergyBar(c);
  }

  c.restore();
}

/**
 * 때릴 때 번쩍하는 부채꼴.
 * 실제 데미지 판정과 똑같은 크기·모양(가로로 길쭉한 타원 + 앞쪽 120도)으로 그려서,
 * 눈에 보이는 범위와 실제로 맞는 범위가 어긋나지 않게 했습니다.
 */
function drawHitFx(c, f) {
  const t = 1 - f.life / f.max;             // 0 -> 1 로 퍼져나감
  const a = Math.max(0, f.life / f.max);
  const rx = f.rx, ry = f.ry, half = f.half, aim = f.ang;

  // 안쪽에서 바깥으로 훑고 지나가는 띠
  const inner = Math.max(0, t * 1.05 - 0.22);
  const outer = Math.min(1, t * 1.05 + 0.30);

  c.save();
  const S = 2;                              // 2px 격자로 찍어 도트 느낌 유지
  const x0 = Math.floor((f.x - rx) / S) * S, x1 = f.x + rx;
  const y0 = Math.floor((f.y - ry) / S) * S, y1 = f.y + ry;
  for (let y = y0; y <= y1; y += S) {
    for (let x = x0; x <= x1; x += S) {
      const dx = x + S / 2 - f.x, dy = y + S / 2 - f.y;
      const nx = dx / rx, ny = dy / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d > outer || d < inner || d > 1) continue;
      let ad = Math.atan2(dy, dx) - aim;
      while (ad > Math.PI) ad -= Math.PI * 2;
      while (ad < -Math.PI) ad += Math.PI * 2;
      const an = Math.abs(ad);
      if (an > half) continue;
      // 가장자리로 갈수록, 띠 바깥으로 갈수록 옅어집니다
      const edge = 1 - an / half;
      const band = 1 - Math.abs(d - (inner + outer) / 2) / ((outer - inner) / 2 + 0.001);
      const al = a * 0.55 * Math.max(0, edge) * Math.max(0, band);
      if (al < 0.05) continue;
      c.globalAlpha = Math.min(0.8, al);
      c.fillStyle = d > 0.72 ? '#ffffff' : d > 0.42 ? '#fff6b0' : '#ffd34d';
      c.fillRect(x, y, S, S);
    }
  }

  // 스톤 바로 앞에서 터지는 밝은 심지
  c.globalAlpha = a;
  const cxp = f.x + Math.cos(aim) * rx * 0.3;
  const cyp = f.y + Math.sin(aim) * ry * 0.3;
  const r = 5 + t * 7;
  ell(c, cxp, cyp, r, r * 0.85, 'rgba(255,255,255,0.5)');
  ell(c, cxp, cyp, r - 2.5, (r - 2.5) * 0.85, 'rgba(255,240,150,0.85)');

  // 부채꼴 바깥 테두리를 따라 튀는 불똥
  c.globalAlpha = a * 0.9;
  for (let i = 0; i < 7; i++) {
    const ang = aim + (i / 6 - 0.5) * 2 * half;
    const k = Math.min(1, t + 0.12);
    px(c, f.x + Math.cos(ang) * rx * k, f.y + Math.sin(ang) * ry * k, '#ffffff', 2, 2);
  }
  c.restore();
}
