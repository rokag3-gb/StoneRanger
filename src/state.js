// 게임 전체가 공유하는 상태와 화면(씬) 전환기.

import { CFG } from './config.js';

export const G = {
  // 화면
  can: null, ctx: null,       // 실제 캔버스 (한글 글자를 또렷하게 그리는 곳)
  vcan: null, vctx: null,     // 가상 저해상도 캔버스 (도트 그림을 그리는 곳)
  W: 0, H: 0,                 // 실제 픽셀 크기
  vw: 480, vh: 270,           // 가상 픽셀 크기
  scale: 3,                   // 확대 배율 (정수라서 도트가 깨지지 않습니다)

  // 진행 상황
  score: 0,
  stage: 0,
  time: 0,
  nukes: 0,            // 남은 핵폭탄. 스테이지가 넘어가도 다시 채워지지 않습니다

  // 씬
  scenes: {},
  scene: null,
  sceneName: '',
  fade: 0,

  go(name, data) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = this.scenes[name];
    this.sceneName = name;
    this.fade = 1;
    if (this.scene && this.scene.enter) this.scene.enter(data || {});
  },

  reset() {
    this.score = 0;
    this.stage = 0;
    this.nukes = CFG.NUKE.start;
  },
};
