// 최종 보스 "엄마" - 스테이지 3에서 삐로디를 모두 잡으면 지도 어딘가에서 걸어옵니다.
// 공격은 하지 않고 삐로디처럼 몸이 닿으면 스톤의 에너지가 깎입니다.

import { CFG } from './config.js';
import { drawMom } from './sprites.js';

const B = CFG.BOSS;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (range) => rnd(range[0], range[1]);

export class Boss {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.hp = B.hp;
    this.maxHp = B.hp;
    this.dead = false;
    this.pop = 0;                 // 쓰러지는 연출 0..1
    this.flash = 0;
    this.stun = 0;
    this.vx = 0; this.vy = 0;
    this.walk = 0;
    this.moving = false;
    this.facing = 'down';
    this.t = 0;
    this.stuck = 0;               // 벽에 막힌 시간
    this.detour = 0;              // 돌아가는 중인 시간
    this.detourAng = 0;

    // 'chase' 쫓아오기 / 'rest' 멈춰서 쉬기 / 'wander' 엉뚱한 데로 걷기
    this.phase = 'chase';
    this.phaseTime = pick(B.chaseTime);
    this.wanderAng = rnd(0, Math.PI * 2);
    this.turnTime = pick(B.wanderTurn);
  }

  /**
   * 다음 행동을 고릅니다.
   * 계속 쫓아오기만 하면 도망칠 틈이 없어서, 한 번 쫓아온 뒤에는
   * 반드시 쉬거나 다른 데로 걸어갑니다.
   */
  nextPhase() {
    if (this.phase === 'chase') {
      if (Math.random() < B.restChance) {
        this.phase = 'rest';
        this.phaseTime = pick(B.restTime);
      } else {
        this.phase = 'wander';
        this.wanderAng = rnd(0, Math.PI * 2);
        this.turnTime = pick(B.wanderTurn);
        this.phaseTime = pick(B.wanderTime);
      }
    } else {
      this.phase = 'chase';
      this.phaseTime = pick(B.chaseTime);
    }
  }

  get gone() { return this.dead && this.pop >= 1; }

  update(dt, world, stone) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

    if (this.dead) {
      this.pop = Math.min(1, this.pop + dt / B.fallTime);
      this.moving = false;
      return;
    }

    this.stun = Math.max(0, this.stun - dt);
    this.vx *= Math.pow(0.002, dt);
    this.vy *= Math.pow(0.002, dt);

    if (this.stun > 0) {
      world.move(this, this.vx * dt, this.vy * dt, 10, 6);
      this.moving = false;
      return;
    }

    // --- 행동 바꾸기
    this.phaseTime -= dt;
    if (this.phaseTime <= 0) this.nextPhase();

    // 쉬는 동안에는 제자리에 서 있습니다 (플레이어가 숨 돌릴 틈)
    if (this.phase === 'rest') {
      world.move(this, this.vx * dt, this.vy * dt, 10, 6);
      this.moving = false;
      this.walk += dt * 1.2;
      this.stuck = 0;
      return;
    }

    let ang, speed;
    if (this.phase === 'chase') {
      ang = Math.atan2(stone.y - this.y, stone.x - this.x);
      ang += Math.sin(this.t * 1.6) * 0.16;        // 곧장 오지 않고 조금 흔들리며
      speed = B.speed;
    } else {
      // 배회하는 동안에도 계속 방향을 틀어서 부지런히 돌아다니게 합니다
      this.turnTime -= dt;
      if (this.turnTime <= 0) {
        this.wanderAng += rnd(-1.6, 1.6);
        this.turnTime = pick(B.wanderTurn);
      }
      ang = this.wanderAng;
      speed = B.speed * B.wanderSpeed;
    }

    if (this.detour > 0) {
      this.detour -= dt;
      ang = this.detourAng;
    }

    if (world.isWaterAt(this.x, this.y - 2)) speed *= B.waterSlow;

    const bx = this.x, by = this.y;
    world.move(this, (Math.cos(ang) * speed + this.vx) * dt,
      (Math.sin(ang) * speed + this.vy) * dt, 10, 6);

    const moved = Math.hypot(this.x - bx, this.y - by);
    this.moving = moved > 0.05;

    // 나무나 집에 막혀 제자리걸음이면 잠깐 옆으로 돌아갑니다
    if (moved < speed * dt * 0.25) {
      this.stuck += dt;
      if (this.stuck > 0.35 && this.detour <= 0) {
        if (this.phase === 'wander') {
          this.wanderAng = rnd(0, Math.PI * 2);
        } else {
          const side = Math.random() < 0.5 ? 1 : -1;
          this.detourAng = Math.atan2(stone.y - this.y, stone.x - this.x) + side * 1.35;
          this.detour = 0.7;
        }
        this.stuck = 0;
      }
    } else {
      this.stuck = 0;
    }

    if (this.moving) {
      this.walk += dt * 7;
      const dx = this.x - bx, dy = this.y - by;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 'left' : 'right';
      else this.facing = dy < 0 ? 'up' : 'down';
    } else {
      this.walk += dt * 1.5;
    }
  }

  /** 맞았을 때. 쓰러졌으면 true */
  hit(fromX, fromY, dmg = 1) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.flash = 0.14;
    this.stun = B.stunTime;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.vx = Math.cos(a) * B.hitKnock;
    this.vy = Math.sin(a) * B.hitKnock;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.pop = 0; return true; }
    return false;
  }

  /** 몸이 닿았는지 (스톤이 닿으면 에너지가 깎입니다) */
  touches(stone) {
    if (this.dead) return false;
    const dx = stone.x - this.x;
    const dy = (stone.y - 10) - (this.y - 16);
    return (dx * dx) / (18 * 18) + (dy * dy) / (20 * 20) < 1;
  }

  /** 스톤의 공격 부채꼴 안에 있는지 */
  inAttack(a) {
    if (this.dead) return false;
    const dx = this.x - a.x;
    const dy = (this.y - 16) - a.y;
    const nx = dx / (a.range * a.wideX + 10);
    const ny = dy / (a.range + 10);
    if (nx * nx + ny * ny > 1) return false;
    if (dx * dx + dy * dy < 400) return true;
    let d = Math.atan2(dy, dx) - a.aim;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) <= a.half;
  }

  draw(c, t) {
    c.save();
    if (this.dead) {
      // 쓰러지면서 서서히 사라집니다
      c.globalAlpha = Math.max(0, 1 - this.pop);
    }
    drawMom(c, this.x, this.y + (this.dead ? this.pop * 6 : 0), {
      s: B.scale,
      t: this.t,
      walk: this.walk,
      moving: this.moving,
      facing: this.facing,
      flash: this.flash > 0,
    });
    c.restore();

    // 쉬는 중이면 머리 위에 점 세 개가 깜빡입니다 (지금은 안 쫓아온다는 표시)
    if (!this.dead && this.phase === 'rest') {
      const n = Math.floor(this.t * 3) % 4;
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        if (i >= n) continue;
        c.fillRect(Math.round(this.x - 5 + i * 4), Math.round(this.y - 52), 2, 2);
      }
    }
  }

  /** 머리 위 체력 막대 - 스톤 막대의 2배 길이 */
  drawHpBar(c) {
    if (this.dead) return;
    const w = B.barW, h = 5;
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - 62);
    const r = Math.max(0, this.hp / this.maxHp);

    c.fillStyle = '#1f1a26'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
    c.fillStyle = '#4a3f52'; c.fillRect(x, y, w, h);
    const fill = Math.round(w * r);
    const col = r > 0.5 ? '#ff5a5a' : r > 0.25 ? '#ff9a3c' : '#ffd23d';
    c.fillStyle = col; c.fillRect(x, y, fill, h);
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(x, y, fill, 1);
    // 칸 나누는 눈금
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 1; i < 6; i++) c.fillRect(x + Math.round((w / 6) * i), y, 1, h);
    // 왕관 표시
    c.fillStyle = '#ffd23d';
    c.fillRect(x - 8, y + 1, 1, 3); c.fillRect(x - 6, y, 1, 4); c.fillRect(x - 4, y + 1, 1, 3);
    c.fillRect(x - 8, y + 4, 5, 1);
  }
}
