// 스톤 레인저 - 시작점.
//
// 그리는 방식:
//   1) 낮은 해상도의 가상 캔버스에 도트 그림을 그립니다
//   2) 정수 배율로 확대해서 실제 캔버스에 붙입니다 (그래서 도트가 안 깨집니다)
//   3) 그 위에 한글 글자와 창을 원래 해상도로 그립니다 (그래서 글자가 또렷합니다)

import { CFG } from './config.js';
import { G } from './state.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

import { introScene } from './scenes/intro.js';
import { selectScene } from './scenes/select.js';
import { playScene } from './scenes/play.js';
import { clearScene, endingScene } from './scenes/clear.js';
import { gameoverScene } from './scenes/gameover.js';

// ---------------------------------------------------------------- 캔버스 준비

const can = document.getElementById('game');
G.can = can;
G.ctx = can.getContext('2d', { alpha: false });
G.vcan = document.createElement('canvas');
G.vctx = G.vcan.getContext('2d', { alpha: false });

function resize() {
  const w = Math.max(320, window.innerWidth);
  const h = Math.max(240, window.innerHeight);
  can.width = w; can.height = h;
  G.W = w; G.H = h;

  // 창 크기에 맞는 정수 배율을 고르고, 가상 해상도를 거기에 맞춥니다.
  // 이렇게 하면 여백 없이 화면을 꽉 채우면서도 픽셀이 고르게 유지됩니다.
  const s = Math.round(Math.min(w / CFG.BASE_W, h / CFG.BASE_H));
  G.scale = Math.max(CFG.MIN_SCALE, Math.min(CFG.MAX_SCALE, s));
  G.vw = Math.ceil(w / G.scale);
  G.vh = Math.ceil(h / G.scale);
  G.vcan.width = G.vw;
  G.vcan.height = G.vh;

  G.vctx.imageSmoothingEnabled = false;
  G.ctx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- 씬 등록

G.scenes = {
  intro: introScene,
  select: selectScene,
  play: playScene,
  clear: clearScene,
  ending: endingScene,
  gameover: gameoverScene,
};

// ---------------------------------------------------------------- 메인 루프

let last = performance.now();

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  // 탭을 다시 켰을 때 시간이 확 튀지 않도록 막습니다
  if (dt > 1 / 20) dt = 1 / 20;
  G.time += dt;

  const scene = G.scene;
  if (scene) {
    scene.update(dt);

    // 1) 도트 레이어
    G.vctx.setTransform(1, 0, 0, 1, 0, 0);
    G.vctx.imageSmoothingEnabled = false;
    G.vctx.fillStyle = '#0d1b12';
    G.vctx.fillRect(0, 0, G.vw, G.vh);
    if (scene.draw) scene.draw();

    // 2) 확대해서 붙이기
    G.ctx.setTransform(1, 0, 0, 1, 0, 0);
    G.ctx.imageSmoothingEnabled = false;
    G.ctx.drawImage(G.vcan, 0, 0, G.vw * G.scale, G.vh * G.scale);

    // 3) 글자 레이어
    if (scene.drawUI) scene.drawUI();
  }

  // 화면이 바뀔 때 살짝 어두워졌다 밝아집니다
  if (G.fade > 0) {
    G.fade = Math.max(0, G.fade - dt * 3.5);
    G.ctx.fillStyle = `rgba(8,18,10,${G.fade})`;
    G.ctx.fillRect(0, 0, G.W, G.H);
  }

  Input.endFrame();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- 시작

// 브라우저가 자동재생을 막았을 때를 위한 보험. 첫 입력이 들어오면 그때 다시 켭니다.
Input.onFirstInput(() => Sound.unlock());

Sound.probeOverrides().finally(() => {
  const boot = document.getElementById('boot');
  if (boot) boot.remove();

  G.go('intro');        // 여기서 인트로 곡이 예약되고
  Sound.unlock();       // 바로 재생을 시도합니다 (자동재생이 허용된 브라우저면 즉시 소리가 납니다)

  last = performance.now();
  requestAnimationFrame(frame);
});

// 개발용: 콘솔에서 밸런스를 바로 만져볼 수 있게 열어둡니다
window.StoneRanger = { G, CFG, Sound };
