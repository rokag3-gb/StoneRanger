// 스톤 - 주인공. 이동, 걷기 애니메이션, 팔다리 공격, 에너지를 담당합니다.

import { CFG } from './config.js';
import { drawStone, ell } from './sprites.js';
import { Sound } from './audio.js';

const S = CFG.STONE;

export class Stone {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;          // 넉백용 여분 속도
    this.facing = 'down';              // 그림을 좌우로 뒤집기 위한 대략적인 방향
    this.aim = Math.PI / 2;            // 실제 조준 각도(라디안). 대각선까지 그대로 담깁니다
    this.walk = 0;
    this.moving = false;
    this.energy = S.maxEnergy;
    this.invuln = 0;
    this.swing = null;                  // { limb, p, dur, dir, hitDone, hit:Set }
    this.cooldown = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.expr = 'normal';
    this.forceExpr = null;              // 클리어/게임오버 연출용
    this.hurtTimer = 0;
    this.splashTimer = 0;
    this.hidden = false;
    this.cheer = 0;                     // 클리어 때 화이팅 동작
  }

  get alive() { return this.energy > 0; }

  /**
   * 공격 판정 범위 - 조준한 방향으로 퍼지는 부채꼴.
   * 각도로 계산하므로 좌상·우하 같은 대각선 공격도 그대로 됩니다.
   */
  attackArea() {
    return {
      x: this.x,
      y: this.y - 13,                      // 몸통 중심
      aim: this.aim,
      range: S.hitRange + S.hitBodyAllow,
      wideX: S.hitWideX,
      half: (S.hitAngle * Math.PI) / 180,
    };
  }

  /** 공격 이펙트가 터지는 위치 */
  fxPos() {
    return {
      x: this.x + Math.cos(this.aim) * S.fxReach,
      y: this.y - 13 + Math.sin(this.aim) * S.fxReach,
      ang: this.aim,
    };
  }

  update(dt, world, input, opts = {}) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.splashTimer = Math.max(0, this.splashTimer - dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // --- 이동
    const ax = input.axis();
    let dx = ax.x, dy = ax.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }
    this.moving = len > 0;

    // 움직이는 방향이 곧 조준 방향. 대각선을 누르면 대각선으로 조준됩니다.
    if (len > 0) this.aim = Math.atan2(dy, dx);
    if (Math.abs(ax.x) > 0) this.facing = ax.x < 0 ? 'left' : 'right';
    else if (Math.abs(ax.y) > 0) this.facing = ax.y < 0 ? 'up' : 'down';

    const inWater = world.isWaterAt(this.x, this.y - 2);
    let speed = S.speed * (inWater ? S.waterSlow : 1);
    if (this.swing) speed *= 0.55;      // 휘두르는 동안엔 살짝 느려집니다

    if (inWater && this.moving && this.splashTimer <= 0) {
      Sound.sfx('splash');
      this.splashTimer = 0.42;
    }

    // 넉백 감쇠
    this.vx *= Math.pow(0.0015, dt);
    this.vy *= Math.pow(0.0015, dt);

    world.move(this, (dx * speed + this.vx) * dt, (dy * speed + this.vy) * dt, 6, 4);

    if (this.moving) this.walk += dt * (inWater ? 7 : 11);
    else this.walk += dt * 2;

    // --- 공격
    // 톡 누르면 바로 한 대, 꾹 누르고 있어도 계속 나갑니다.
    // (꾹 누르기를 허용하면 키보드가 잠깐 키를 놓쳐도 다시 이어서 공격이 나갑니다)
    const tapped = input.attackPressed();
    const held = input.attackDown();
    if (!opts.noAttack && this.cooldown <= 0 && (tapped || (held && !this.swing))) {
      this.startSwing();
    }
    if (this.swing) {
      this.swing.p += dt / this.swing.dur;
      if (this.swing.p >= 1) this.swing = null;
    }

    // --- 표정
    if (this.forceExpr) this.expr = this.forceExpr;
    else if (this.hurtTimer > 0) this.expr = 'hurt';
    else if (this.swing || this.combo > 0) this.expr = 'serious';
    else this.expr = 'normal';
  }

  startSwing() {
    this.comboTimer = S.comboWindow;
    this.combo = Math.min(9, this.combo + 1);
    const fast = this.combo >= 2;
    const dur = fast ? S.atkDurFast : S.atkDur;
    // 팔 -> 다리 -> 팔 -> 다리 번갈아 (두두다다)
    const limb = (this.combo % 2 === 1) ? 'arm' : 'leg';
    this.swing = { limb, p: 0, dur, dir: this.facing, hitDone: false, hit: new Set() };
    this.cooldown = S.atkCooldown;
  }

  /** 에너지를 깎습니다. 실제로 맞았으면 true */
  takeHit(fromX, fromY) {
    if (this.invuln > 0) return false;
    this.energy = Math.max(0, this.energy - S.damage);
    this.invuln = S.invuln;
    this.hurtTimer = 0.6;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.vx = Math.cos(a) * S.knockback;
    this.vy = Math.sin(a) * S.knockback;
    Sound.sfx('hurt');
    return true;
  }

  refill() { this.energy = S.maxEnergy; this.invuln = 0; this.hurtTimer = 0; }

  draw(c, t) {
    const blink = this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0;   // 무적 동안 깜빡임
    const cheering = this.cheer > 0;

    drawStone(c, this.x, this.y, {
      facing: cheering ? 'down' : this.facing,
      aim: cheering ? -Math.PI / 2 : this.aim,
      walk: this.walk,
      moving: this.moving,
      swing: this.swing ? { limb: this.swing.limb, p: this.swing.p } : null,
      expr: this.expr,
      flash: blink,
    });

    if (cheering) this.drawCheerArms(c);
  }

  /** 클리어 연출: 두 팔을 번쩍 들고 "화이팅!" */
  drawCheerArms(c) {
    const lift = -9 * (0.5 + 0.5 * Math.sin(this.cheer * 7));
    const cy = -13 - Math.sin(this.walk * 0.9) * 0.6;   // drawStone 의 기본 흔들림과 맞춤
    c.save();
    c.translate(Math.round(this.x), Math.round(this.y));
    for (const s of [-1, 1]) {
      ell(c, s * 10.5, cy - 1 + lift, 5.4, 4.4, '#3a2740');
      ell(c, s * 10.5, cy - 1 + lift, 4.4, 3.4, '#8d5c33');
      ell(c, s * 10.5 - 1.3, cy - 2.2 + lift, 1.8, 1.2, '#ad7444');
    }
    c.restore();
  }

  /** 머리 위 초록 에너지 막대 */
  drawEnergyBar(c) {
    const w = 26, h = 4;
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - 40);
    const r = Math.max(0, this.energy / S.maxEnergy);

    c.fillStyle = '#1f1a26'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
    c.fillStyle = '#4a3f52'; c.fillRect(x, y, w, h);
    const fill = Math.round(w * r);
    const col = r > 0.5 ? '#4ee04e' : r > 0.25 ? '#ffd23d' : '#ff4d4d';
    c.fillStyle = col; c.fillRect(x, y, fill, h);
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(x, y, fill, 1);
    // 하트 표시
    c.fillStyle = '#ff6b8a';
    c.fillRect(x - 6, y, 2, 2); c.fillRect(x - 3, y, 2, 2);
    c.fillRect(x - 6, y + 2, 5, 1); c.fillRect(x - 5, y + 3, 3, 1);
  }
}
