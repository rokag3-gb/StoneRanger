// 삐로디 - 초록 젤리 악당. 평소엔 랜덤하게 어슬렁거리다가 스톤이 가까이 오면
// 가끔 슬금슬금 다가옵니다. 스테이지가 올라갈수록 자주, 더 빠르게 다가옵니다.

import { CFG } from './config.js';
import { drawPirodi } from './sprites.js';

const P = CFG.PIRODI;
const rnd = (a, b) => a + Math.random() * (b - a);

export class Pirodi {
  constructor(x, y, stageCfg) {
    this.x = x; this.y = y;
    this.cfg = stageCfg;
    this.hp = P.hp;
    this.maxHp = P.hp;
    this.dead = false;
    this.pop = 0;                 // 죽는 연출 진행도 0..1
    this.flash = 0;
    this.stun = 0;
    this.vx = 0; this.vy = 0;     // 넉백
    this.dir = rnd(0, Math.PI * 2);
    this.think = rnd(0, 0.6);
    this.chasing = 0;             // 남은 추격 시간
    this.t = rnd(0, 6.28);
    this.moving = true;
  }

  get gone() { return this.dead && this.pop >= 1; }

  update(dt, world, stone) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

    if (this.dead) {
      this.pop = Math.min(1, this.pop + dt / P.popTime);
      return;
    }

    this.stun = Math.max(0, this.stun - dt);
    this.vx *= Math.pow(0.002, dt);
    this.vy *= Math.pow(0.002, dt);

    if (this.stun > 0) {
      world.move(this, this.vx * dt, this.vy * dt, 5, 4);
      this.moving = false;
      return;
    }

    // --- 생각할 시간마다 방향을 새로 정합니다
    this.think -= dt;
    if (this.chasing > 0) this.chasing -= dt;

    if (this.think <= 0) {
      const [lo, hi] = this.cfg.think;
      this.think = rnd(lo, hi);
      const d = Math.hypot(stone.x - this.x, stone.y - this.y);
      if (d < this.cfg.radius && Math.random() < this.cfg.chase) {
        this.chasing = rnd(0.7, 1.5);        // 은근슬쩍 다가가기
      } else {
        this.chasing = 0;
        this.dir = rnd(0, Math.PI * 2);
        this.moving = Math.random() > 0.18;  // 가끔은 멈춰서 두리번
      }
    }

    let ang = this.dir;
    let speed = this.cfg.speed;
    if (this.chasing > 0) {
      ang = Math.atan2(stone.y - this.y, stone.x - this.x);
      ang += Math.sin(this.t * 3) * 0.35;    // 곧장 오지 않고 흐느적흐느적
      speed *= 1.12;
      this.moving = true;
    }

    if (this.moving) {
      if (world.isWaterAt(this.x, this.y - 2)) speed *= P.waterSlow;
      const before = { x: this.x, y: this.y };
      world.move(this, (Math.cos(ang) * speed + this.vx) * dt, (Math.sin(ang) * speed + this.vy) * dt, 5, 4);
      // 벽에 막혔으면 방향을 바꿉니다
      if (Math.abs(this.x - before.x) < 0.01 && Math.abs(this.y - before.y) < 0.01 && this.chasing <= 0) {
        this.dir = rnd(0, Math.PI * 2);
        this.think = Math.min(this.think, 0.15);
      }
    } else {
      world.move(this, this.vx * dt, this.vy * dt, 5, 4);
    }
  }

  /** 맞았을 때. 죽었으면 true */
  hit(fromX, fromY, knock) {
    if (this.dead) return false;
    this.hp -= 1;
    this.flash = 0.14;
    this.stun = P.stunTime;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.vx = Math.cos(a) * knock;
    this.vy = Math.sin(a) * knock;
    if (this.hp <= 0) { this.dead = true; this.pop = 0; return true; }
    return false;
  }

  /** 핵폭탄에 맞아 한 방에 터집니다 */
  obliterate(fromX, fromY) {
    if (this.dead) return false;
    this.hp = 0;
    this.dead = true;
    this.pop = 0;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.vx = Math.cos(a) * 220;
    this.vy = Math.sin(a) * 220;
    return true;
  }

  /** 몸이 겹치는지 (스톤이 닿으면 에너지가 깎입니다) */
  touches(stone) {
    if (this.dead) return false;
    const dx = stone.x - this.x;
    const dy = (stone.y - 10) - (this.y - 7);
    return (dx * dx) / (13 * 13) + (dy * dy) / (12 * 12) < 1;
  }

  /**
   * 공격 부채꼴 안에 있는지.
   * 거리 + 각도로 판정하므로 대각선 공격도 그대로 맞습니다.
   */
  inAttack(a) {
    if (this.dead) return false;
    const dx = this.x - a.x;
    const dy = (this.y - 7) - a.y;
    // 가로로 살짝 더 길쭉한 타원 범위 (좌우 공격이 위아래보다 짧게 느껴지던 문제)
    const nx = dx / (a.range * a.wideX);
    const ny = dy / a.range;
    if (nx * nx + ny * ny > 1) return false;
    // 바로 코앞(거의 겹친 상태)이면 각도를 따지지 않고 맞습니다
    if (dx * dx + dy * dy < 100) return true;
    let d = Math.atan2(dy, dx) - a.aim;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) <= a.half;
  }

  draw(c, t) {
    drawPirodi(c, this.x, this.y, {
      t: this.t,
      hp: this.hp, maxHp: this.maxHp,
      flash: this.flash > 0,
      pop: this.pop,
      angry: this.chasing > 0,
    });
  }
}
