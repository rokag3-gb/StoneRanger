// 스테이지 플레이 - 지도, 스톤, 삐로디, 일시정지 메뉴.

import { CFG } from '../config.js';
import { G } from '../state.js';
import { Input } from '../input.js';
import { Sound } from '../audio.js';
import { World, renderField } from '../world.js';
import { Stone } from '../stone.js';
import { Pirodi } from '../pirodi.js';
import { Boss } from '../boss.js';
import { drawHUD, drawBanner, drawMenu, drawHint, text } from '../ui.js';

const PAUSE_ITEMS = [{ label: '게임 계속하기' }, { label: '나가기' }];
const CONFIRM_ITEMS = [{ label: '아니오' }, { label: '예' }];

export const playScene = {
  enter(data) {
    const stage = data.stage ?? 0;
    G.stage = stage;
    const cfg = CFG.STAGES[stage];

    this.t = 0;
    this.world = new World({ w: cfg.mapW, h: cfg.mapH, trees: cfg.trees, houses: cfg.houses });
    this.stone = new Stone(this.world.spawn.x, this.world.spawn.y);
    if (data.energy != null) this.stone.energy = data.energy;

    // 삐로디를 매번 다른 자리에 랜덤 배치
    this.pirodis = [];
    for (let i = 0; i < cfg.count; i++) {
      const p = this.world.randomOpen(this.stone, 110);
      this.pirodis.push(new Pirodi(p.x, p.y, cfg));
    }

    this.particles = [];
    this.hitFx = [];
    this.scorePops = [];
    this.boss = null;        // 최종 보스 "엄마" (마지막 스테이지에서만)
    this.bossIntro = 0;      // "최종 보스 등장" 문구가 떠 있는 시간
    this.isLast = stage >= CFG.STAGES.length - 1;
    this.nuke = null;        // 날아오는 중인 핵폭탄 { x, y, r, t, delay }
    this.blasts = [];        // 터진 자리 { x, y, r, t, max }
    this.cam = { x: this.stone.x, y: this.stone.y - 12, zoom: 1 };
    this.shake = 0;

    this.banner = CFG.BANNER_TIME;
    this.paused = false;
    this.menuIndex = 0;
    this.confirm = null;
    this.endTimer = 0;
    this.ending = null;

    this.state = {
      stone: this.stone, pirodis: this.pirodis,
      particles: this.particles, hitFx: this.hitFx, scorePops: this.scorePops,
      blasts: this.blasts,
      get nuke() { return playScene.nuke; },
      get boss() { return playScene.boss; },
      get score() { return G.score; }, get stage() { return G.stage; },
    };

    Sound.bgm('battle');
    Sound.sfx('stageStart');
  },

  // -------------------------------------------------------------- 갱신

  update(dt) {
    this.t += dt;

    if (this.paused) { this.updatePause(); return; }

    if (Input.justPressed('Escape') && !this.ending) {
      this.paused = true;
      this.menuIndex = 0;
      this.confirm = null;
      Sound.sfx('move');
      return;
    }

    // 스테이지 시작 배너가 떠 있는 동안엔 조작이 잠깁니다
    const locked = this.banner > 0;
    if (this.banner > 0) this.banner -= dt;

    this.shake = Math.max(0, this.shake - dt * 3);

    this.stone.update(dt, this.world, locked ? IDLE_INPUT : Input, { noAttack: locked });
    this.resolveAttack();

    if (!locked && !this.ending && Input.justPressed('Enter')) this.fireNuke();
    this.updateNuke(dt);

    for (const p of this.pirodis) p.update(dt, this.world, this.stone);

    if (this.bossIntro > 0) this.bossIntro -= dt;
    if (this.boss) this.boss.update(dt, this.world, this.stone);

    // 몸이 닿으면 에너지가 깎입니다
    if (!this.ending) {
      let bumped = null;
      for (const p of this.pirodis) { if (p.touches(this.stone)) { bumped = { x: p.x, y: p.y - 7 }; break; } }
      // 보스는 등장 연출이 끝난 뒤부터 피해를 줍니다
      if (!bumped && this.boss && this.bossIntro <= 0 && this.boss.touches(this.stone)) {
        bumped = { x: this.boss.x, y: this.boss.y - 16 };
      }
      if (bumped && this.stone.takeHit(bumped.x, bumped.y)) {
        this.shake = 0.35;
        this.popText(this.stone.x, this.stone.y - 46, '-' + CFG.STONE.damage, '#ff8a8a');
      }
    }

    this.pirodis = this.pirodis.filter((p) => !p.gone);
    this.state.pirodis = this.pirodis;

    this.updateEffects(dt);
    this.updateCamera(dt);
    this.checkEnd(dt);
  },

  resolveAttack() {
    const sw = this.stone.swing;
    if (!sw || sw.hitDone || sw.p < 0.3) return;
    sw.hitDone = true;

    const area = this.stone.attackArea();
    // 이펙트를 실제 판정 범위와 똑같은 크기·모양으로 그립니다
    this.hitFx.push({
      x: area.x, y: area.y, ang: area.aim,
      rx: area.range * area.wideX, ry: area.range, half: area.half,
      life: 0.24, max: 0.24,
    });

    let hitAny = false;
    for (const p of this.pirodis) {
      if (p.dead || !p.inAttack(area)) continue;
      hitAny = true;
      const killed = p.hit(this.stone.x, this.stone.y - 10, CFG.STONE.hitKnock);
      G.score += CFG.SCORE.hit;
      this.popText(p.x, p.y - 20, '+' + CFG.SCORE.hit, '#fff27a');
      if (killed) {
        G.score += CFG.SCORE.kill;
        this.popText(p.x + 6, p.y - 30, '+' + CFG.SCORE.kill, '#a8f06a');
        this.splat(p.x, p.y - 7);
        Sound.sfx('death');
      }
    }
    // 최종 보스도 같은 부채꼴로 때립니다
    if (this.boss && !this.boss.dead && this.boss.inAttack(area)) {
      hitAny = true;
      const down = this.boss.hit(this.stone.x, this.stone.y - 10, 1);
      G.score += CFG.SCORE.hit;
      this.popText(this.boss.x, this.boss.y - 40, '+' + CFG.SCORE.hit, '#fff27a');
      Sound.sfx('bossHit');
      if (down) this.onBossDown();
    }

    if (hitAny) { Sound.hitSfx(); this.shake = Math.max(this.shake, 0.16); }
    else Sound.sfx('shashak');     // 헛스윙은 바람 소리만
  },

  /** 엔터 키 - 핵폭탄 발사 예고 */
  fireNuke() {
    if (this.nuke) return;                       // 이미 날아오는 중
    if (G.nukes <= 0) { Sound.sfx('nukeEmpty'); return; }
    G.nukes -= 1;

    // 일반 공격 범위 "바로 바깥"에 떨어뜨립니다.
    // 타원 가장자리까지의 거리를 조준 방향에 맞춰 구한 뒤 여유분을 더합니다.
    const a = this.stone.attackArea();
    const ca = Math.cos(a.aim), sa = Math.sin(a.aim);
    const rx = a.range * a.wideX, ry = a.range;
    const edge = 1 / Math.sqrt((ca * ca) / (rx * rx) + (sa * sa) / (ry * ry));
    const dist = edge + CFG.NUKE.margin;

    this.nuke = {
      x: a.x + ca * dist,
      y: a.y + sa * dist,
      r: CFG.NUKE.radius,
      t: 0,
      delay: CFG.NUKE.delay,
    };
    Sound.sfx('nukeWarn');
  },

  updateNuke(dt) {
    if (this.nuke) {
      this.nuke.t += dt;
      if (this.nuke.t >= this.nuke.delay) {
        this.detonate(this.nuke.x, this.nuke.y, this.nuke.r);
        this.nuke = null;
      }
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      this.blasts[i].t += dt;
      if (this.blasts[i].t >= this.blasts[i].max) this.blasts.splice(i, 1);
    }
    this.state.blasts = this.blasts;
  },

  /** 핵폭발 - 반경 안의 삐로디를 한 방에 터뜨립니다 */
  detonate(x, y, r) {
    this.blasts.push({ x, y, r, t: 0, max: CFG.NUKE.blastTime });
    this.shake = CFG.NUKE.shake;
    Sound.sfx('nukeBoom');

    let killed = 0;
    for (const p of this.pirodis) {
      if (p.dead) continue;
      const dx = p.x - x, dy = (p.y - 7) - y;
      if (dx * dx + dy * dy > r * r) continue;
      p.obliterate(x, y);
      killed++;
      G.score += CFG.SCORE.kill;
      this.splat(p.x, p.y - 7);
    }
    if (killed > 0) this.popText(x, y - 18, '+' + (CFG.SCORE.kill * killed), '#ff9a6b');

    // 보스에게도 한 방 크게 들어갑니다 (즉사는 아닙니다)
    if (this.boss && !this.boss.dead) {
      const bx = this.boss.x - x, by = (this.boss.y - 16) - y;
      if (bx * bx + by * by <= (r + 16) * (r + 16)) {
        const down = this.boss.hit(x, y, CFG.BOSS.nukeDamage);
        this.popText(this.boss.x, this.boss.y - 46, '-' + CFG.BOSS.nukeDamage, '#ff5a5a');
        if (down) this.onBossDown();
      }
    }

    // 흙먼지
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        r: 1 + Math.random() * 2.4, life: 0.4 + Math.random() * 0.4, max: 0.8,
      });
    }
  },

  /** 삐로디를 다 잡았을 때 최종 보스가 걸어옵니다 */
  summonBoss() {
    const spot = this.world.randomOpen(this.stone, CFG.BOSS.spawnDist);
    this.boss = new Boss(spot.x, spot.y);
    this.bossIntro = CFG.BOSS.introTime;
    Sound.sfx('bossSiren');
  },

  onBossDown() {
    G.score += CFG.BOSS.score;
    this.popText(this.boss.x, this.boss.y - 50, '+' + CFG.BOSS.score, '#ffd23d');
    this.shake = 0.8;
    Sound.sfx('bossDown');
  },

  splat(x, y) {
    for (let i = 0; i < 11; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 70;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
        r: 1 + Math.random() * 2.6, life: 0.5 + Math.random() * 0.35, max: 0.85,
      });
    }
  },

  popText(x, y, str, color) {
    this.scorePops.push({ x, y, text: str, color, life: 0.85, max: 0.85 });
  },

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vy += 220 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.hitFx.length - 1; i >= 0; i--) {
      this.hitFx[i].life -= dt;
      if (this.hitFx[i].life <= 0) this.hitFx.splice(i, 1);
    }
    for (let i = this.scorePops.length - 1; i >= 0; i--) {
      this.scorePops[i].life -= dt;
      if (this.scorePops[i].life <= 0) this.scorePops.splice(i, 1);
    }
    this.state.particles = this.particles;
    this.state.hitFx = this.hitFx;
    this.state.scorePops = this.scorePops;
  },

  updateCamera(dt) {
    const z = this.cam.zoom;
    const hw = G.vw / (2 * z), hh = G.vh / (2 * z);
    let tx = this.stone.x, ty = this.stone.y - 12;
    // 지도가 화면보다 작으면 가운데에 맞춥니다 (스테이지1 처럼 작은 지도 대비)
    tx = this.world.pw <= hw * 2 ? this.world.pw / 2 : Math.max(hw, Math.min(this.world.pw - hw, tx));
    ty = this.world.ph <= hh * 2 ? this.world.ph / 2 : Math.max(hh, Math.min(this.world.ph - hh, ty));
    const k = Math.min(1, dt * 8);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  },

  checkEnd(dt) {
    if (this.ending) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        if (this.ending === 'clear') {
          G.go('clear', { play: this, stage: G.stage });
        } else {
          G.go('gameover');
        }
      }
      return;
    }
    if (this.stone.energy <= 0) {
      this.ending = 'over';
      this.endTimer = 1.1;
      this.stone.forceExpr = 'hurt';
      Sound.stopBgm();
      return;
    }
    // 마지막 스테이지에서는 삐로디를 다 잡으면 보스가 나오고,
    // 보스까지 쓰러뜨려야 클리어입니다.
    if (this.isLast) {
      if (!this.boss && this.pirodis.every((p) => p.dead)) { this.summonBoss(); return; }
      if (!this.boss || !this.boss.dead || this.boss.pop < 1) return;
    }

    if (this.pirodis.every((p) => p.dead)) {
      this.ending = 'clear';
      // 핵폭탄으로 마지막 한 마리를 잡았다면 폭발 연출이 끝나는 것까지 보고 넘어갑니다
      let wait = 0.7;
      for (const b of this.blasts) wait = Math.max(wait, b.max - b.t + 0.15);
      this.endTimer = wait;
    }
  },

  // -------------------------------------------------------------- 일시정지 메뉴

  updatePause() {
    if (this.confirm) {
      if (Input.justPressed('ArrowUp') || Input.justPressed('ArrowDown')) {
        this.confirm.index = 1 - this.confirm.index;
        Sound.sfx('move');
      }
      if (Input.justPressed('Escape')) { this.confirm = null; Sound.sfx('back'); return; }
      if (Input.justPressed('Enter')) {
        if (this.confirm.index === 1) {   // 예
          Sound.sfx('select');
          Sound.stopBgm();
          G.go('intro');
        } else {                          // 아니오
          Sound.sfx('back');
          this.confirm = null;
        }
      }
      return;
    }

    // ESC 를 다시 누르면 "게임 계속하기" 를 고른 것과 같습니다
    if (Input.justPressed('Escape')) { this.paused = false; Sound.sfx('back'); return; }

    if (Input.justPressed('ArrowUp')) {
      this.menuIndex = (this.menuIndex + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length;
      Sound.sfx('move');
    }
    if (Input.justPressed('ArrowDown')) {
      this.menuIndex = (this.menuIndex + 1) % PAUSE_ITEMS.length;
      Sound.sfx('move');
    }
    if (Input.justPressed('Enter')) {
      Sound.sfx('select');
      if (this.menuIndex === 0) this.paused = false;
      else this.confirm = { index: 0 };
    }
  },

  // -------------------------------------------------------------- 그리기

  // 도트 레이어
  draw() {
    const c = G.vctx;

    const sh = this.shake;
    const cam = {
      x: this.cam.x + (sh > 0 ? (Math.random() - 0.5) * sh * 12 : 0),
      y: this.cam.y + (sh > 0 ? (Math.random() - 0.5) * sh * 12 : 0),
      zoom: this.cam.zoom,
    };
    renderField(c, this.world, cam, G.vw, G.vh, this.state, this.t);

    // 피격 시 화면이 살짝 붉어집니다
    if (this.stone.invuln > 0.55) {
      c.fillStyle = `rgba(255,60,60,${(this.stone.invuln - 0.55) * 0.5})`;
      c.fillRect(0, 0, G.vw, G.vh);
    }
  },

  // 글자 레이어
  drawUI() {
    const ctx = G.ctx, u = G.scale;

    drawHUD(ctx, G, { score: G.score, stage: G.stage, pirodis: this.pirodis, nukes: G.nukes, boss: this.boss });

    // 최종 보스 등장
    if (this.bossIntro > 0) {
      const p = this.bossIntro / CFG.BOSS.introTime;
      const blink = Math.sin(this.bossIntro * 16) > -0.3 ? 1 : 0.2;
      const fade = Math.min(1, p / 0.2);
      ctx.save();
      ctx.globalAlpha = 0.2 * blink * fade;
      ctx.fillStyle = '#c00000';
      ctx.fillRect(0, 0, G.W, G.H);
      ctx.restore();
      text(ctx, '최종 보스 등장', G.W / 2, G.H * 0.28, 30 * u, '#ff3030',
        { alpha: blink * fade, outline: '#2a0000', lw: 9 * u });
      text(ctx, '엄마', G.W / 2, G.H * 0.38, 15 * u, '#ffd0d0',
        { alpha: blink * fade, outline: '#2a0000' });
    }

    // 핵공격 경고
    if (this.nuke) {
      const blink = Math.sin(this.nuke.t * 18) > -0.2 ? 1 : 0.15;
      ctx.save();
      ctx.globalAlpha = 0.18 * blink;
      ctx.fillStyle = '#ff2020';
      ctx.fillRect(0, 0, G.W, G.H);
      ctx.restore();
      text(ctx, '핵공격이 감지되었습니다.', G.W / 2, G.H * 0.30, 20 * u, '#ff4040',
        { alpha: blink, outline: '#2a0000', lw: 7 * u });
    }

    // 콤보 표시
    if (this.stone.combo >= 2 && this.stone.comboTimer > 0) {
      const a = Math.min(1, this.stone.comboTimer / 0.3);
      text(ctx, `${this.stone.combo} 연타!`, G.W / 2, G.H * 0.22, 14 * u, '#ffb3e6', { alpha: a });
    }

    // 스테이지 시작 배너
    if (this.banner > 0) {
      const total = CFG.BANNER_TIME;
      const p = this.banner / total;
      const a = p > 0.75 ? (1 - p) / 0.25 : Math.min(1, p / 0.25);
      const goal = this.isLast
        ? '모든 삐로디를 무찌르고 최종보스를 만나보세요'
        : '모든 삐로디를 무찌르세요';
      drawBanner(ctx, G, `스테이지 ${G.stage + 1}`, goal, a);
    }

    if (this.paused) {
      if (this.confirm) {
        drawMenu(ctx, G, '정말 나가시겠어요?', CONFIRM_ITEMS, this.confirm.index);
        drawHint(ctx, G, '▲ ▼ 선택 · 엔터 확인 · ESC 취소');
      } else {
        drawMenu(ctx, G, '잠깐 멈춤', PAUSE_ITEMS, this.menuIndex);
        drawHint(ctx, G, '▲ ▼ 선택 · 엔터 확인 · ESC 계속하기');
      }
    }
  },
};

// 배너가 떠 있는 동안 쓰는 "아무것도 안 누른" 입력
const IDLE_INPUT = {
  axis: () => ({ x: 0, y: 0 }),
  isDown: () => false,
  justPressed: () => false,
  attackPressed: () => false,
  attackDown: () => false,
};
