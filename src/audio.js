// 8비트 사운드 - Web Audio API로 파형을 직접 만들어 냅니다. 음원 파일이 하나도 없어도 소리가 납니다.
//
// assets/audio/ 안에 intro.mp3 / battle.mp3 / gameover.mp3 를 넣어두면
// 합성음 대신 그 파일을 재생합니다. (게임을 새로고침하면 자동으로 감지합니다)

import { CFG } from './config.js';

let ctx = null;
let master = null;
let noiseBuf = null;
let seq = null;          // 지금 돌고 있는 시퀀서 상태
let timer = null;        // 스케줄러 인터벌
let curName = null;      // 지금 재생 중인 BGM 이름
let audioEl = null;      // mp3 오버라이드 재생용
const overrides = {};    // 이름 -> mp3 경로 (파일이 실제로 있을 때만)

// 내 음원 파일 넣기.
// assets/audio/ 안에 아래 이름으로 파일을 넣고 새로고침하면 합성음 대신 그 파일이 재생됩니다.
// 확장자는 mp3 / ogg / wav / m4a 중 아무거나 되고, 먼저 발견되는 것을 씁니다.
const OVERRIDE_EXTS = ['mp3', 'ogg', 'wav', 'm4a'];
const OVERRIDE_NAMES = {
  intro: 'intro',          // 인트로 · 캐릭터 선택 · 엔딩
  battle: 'battle',        // 스테이지 플레이 중
  gameover: 'gameover',    // 게임 오버
};

// 반복 재생 여부. 게임 오버는 한 번만 울리고 조용해지는 편이 더 게임답습니다.
const LOOPING = { intro: true, battle: true, gameover: false };

// ---------------------------------------------------------------- 음이름 -> 주파수

const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function noteFreq(token) {
  const m = /^([A-G][#b]?)(-?\d+)$/.exec(token);
  if (!m) return 0;
  const midi = SEMI[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------------------------------------------------------------- 곡 데이터
// '.' = 쉼표, '-' = 앞 음을 계속 늘림. 16분음표 한 칸이 한 토큰입니다.

const SONGS = {
  // 인트로: 통통 튀는 귀여운 팝.
  //
  // 원하셨던 "츄 - Cutie Pie" 음원 자체는 가져올 수 없어서, 그 곡의 느낌
  // (밝은 장조, 빠른 템포, 당김음이 섞인 깡총깡총한 후렴)을 참고해 직접 만든 오리지널 곡입니다.
  // 실제 음원을 구하시면 assets/audio/intro.mp3 로 넣으면 이 곡 대신 재생됩니다.
  intro: {
    bpm: 138, steps: 64,
    tracks: [
      { wave: 'square', vol: 0.11, hold: 0.72, pat:
        'C5 - E5 - G5 - - . A5 - G5 - E5 - - . ' +
        'F5 - E5 - D5 - - . E5 - D5 - C5 - - . ' +
        'A4 - C5 - F5 - E5 - D5 - C5 - D5 - - . ' +
        'G4 - B4 - D5 - G5 - E5 - C5 - - - . . ' },
      { wave: 'triangle', vol: 0.17, hold: 0.55, pat:
        'C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 . ' +
        'F3 . C4 . F3 . C4 . C3 . G3 . C3 . G3 . ' +
        'D3 . A3 . D3 . A3 . F3 . C4 . F3 . C4 . ' +
        'G3 . D4 . G3 . D4 . C3 . G3 . C3 . E3 . ' },
      { wave: 'sine', vol: 0.05, hold: 0.45, pat:
        '. . E6 . . . C6 . . . G5 . . . C6 . ' },
    ],
    drums: { len: 16, kick: [0, 7, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  },

  // --- 예전 인트로 음악 (느긋한 장조). 지우지 않고 남겨둡니다. ---
  // intro_old: {
  //   bpm: 100, steps: 64,
  //   tracks: [
  //     { wave: 'square', vol: 0.10, hold: 0.85, pat:
  //       'G4 - - - C5 - - - E5 - - - D5 - - - ' +
  //       'C5 - - - E5 - - - G5 - - - - - . . ' +
  //       'A4 - - - C5 - - - F5 - - - E5 - - - ' +
  //       'D5 - - - B4 - - - C5 - - - - - . . ' },
  //     { wave: 'triangle', vol: 0.16, hold: 0.92, pat:
  //       'C3 - - - - - - - G3 - - - - - - - ' +
  //       'C3 - - - - - - - E3 - - - - - - - ' +
  //       'F3 - - - - - - - C3 - - - - - - - ' +
  //       'G3 - - - - - - - G3 - - - - - - - ' },
  //     { wave: 'sine', vol: 0.05, hold: 0.5, pat:
  //       '. . E5 . . . G5 . . . C6 . . . G5 . ' +
  //       '. . E5 . . . G5 . . . C6 . . . G5 . ' +
  //       '. . F5 . . . A5 . . . C6 . . . A5 . ' +
  //       '. . D5 . . . G5 . . . B5 . . . G5 . ' },
  //   ],
  // },

  // 전투(게임 플레이 중): "열 꼬마 인디언"을 8비트로 편곡했습니다.
  //
  // 처음 주신 유튜브 링크(지니키즈 - 열 꼬마 인디언)의 음원 파일 자체는 가져올 수 없지만,
  // 그 노래의 멜로디는 1868년 곡이라 저작권이 풀린 전래동요입니다. 그래서 멜로디를 그대로
  // 옮겨 직접 편곡했습니다. 아이가 아는 바로 그 노래가 6/8 박자로 통통 튀며 흘러갑니다.
  battle: {
    bpm: 132, steps: 96,     // 8분음표 = 2스텝, 6/8 한 마디 = 12스텝
    tracks: [
      // 멜로디: 한 꼬마 두 꼬마 세 꼬마 인디언 ...
      { wave: 'square', vol: 0.11, hold: 0.8, pat:
        'C5 - C5 - C5 - C5 - C5 - C5 - E5 - G5 - G5 - E5 - C5 - - - ' +
        'D5 - D5 - D5 - D5 - D5 - D5 - B4 - D5 - D5 - B4 - G4 - - - ' +
        'C5 - C5 - C5 - C5 - C5 - C5 - E5 - G5 - G5 - E5 - C5 - - - ' +
        'G5 - F5 - F5 - E5 - D5 - C5 - - - - - . . . . . . . . ' },
      // 베이스: 으쿵 짝 으쿵 짝
      { wave: 'triangle', vol: 0.17, hold: 0.85, pat:
        'C3 - - - - - G3 - - - - - C3 - - - - - G3 - - - - - ' +
        'G2 - - - - - D3 - - - - - G2 - - - - - D3 - - - - - ' +
        'C3 - - - - - G3 - - - - - C3 - - - - - G3 - - - - - ' +
        'G2 - - - - - D3 - - - - - C3 - - - - - - - - - - - ' },
      // 화음 찌르기
      { wave: 'square', vol: 0.05, hold: 0.35, pat:
        '. . E4 . . . ' + '. . G4 . . . ' + '. . E4 . . . ' + '. . G4 . . . ' +
        '. . D4 . . . ' + '. . G4 . . . ' + '. . D4 . . . ' + '. . G4 . . . ' +
        '. . E4 . . . ' + '. . G4 . . . ' + '. . E4 . . . ' + '. . G4 . . . ' +
        '. . D4 . . . ' + '. . G4 . . . ' + '. . E4 . . . ' + '. . C4 . . . ' },
    ],
    // 6/8 박자라 드럼은 12스텝 주기입니다
    drums: { len: 12, kick: [0], snare: [6], hat: [0, 2, 4, 6, 8, 10] },
  },

  // --- 예전 전투 음악 (직접 만든 신나는 단조 루프). 지우지 않고 남겨둡니다. ---
  // 다시 쓰고 싶으면 위 battle 을 battle_new 로 바꾸고, 아래 주석을 풀어 이름을 battle 로 쓰세요.
  //
  // battle_old: {
  //   bpm: 152, steps: 64,
  //   tracks: [
  //     { wave: 'square', vol: 0.10, hold: 0.7, pat:
  //       'A4 . A4 . C5 . D5 . E5 . D5 . C5 . A4 . ' +
  //       'G4 . G4 . A4 . C5 . D5 . C5 . A4 . G4 . ' +
  //       'A4 . A4 . C5 . E5 . G5 . E5 . D5 . C5 . ' +
  //       'D5 . C5 . A4 . G4 . A4 - - - . . . . ' },
  //     { wave: 'triangle', vol: 0.17, hold: 0.6, pat:
  //       'A2 . A2 . A2 . A2 . A2 . A2 . A2 . A2 . ' +
  //       'F2 . F2 . F2 . F2 . G2 . G2 . G2 . G2 . ' +
  //       'A2 . A2 . A2 . A2 . C3 . C3 . C3 . C3 . ' +
  //       'D3 . D3 . C3 . C3 . A2 . A2 . E3 . E3 . ' },
  //     { wave: 'square', vol: 0.04, hold: 0.4, pat:
  //       '. . E5 . . . A5 . . . E5 . . . C5 . ' },
  //   ],
  //   drums: { len: 16, kick: [0, 6, 8, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  // },

  // 엔딩: 불꽃놀이에 어울리는 신나는 축하곡 (오리지널)
  ending: {
    bpm: 150, steps: 64,
    tracks: [
      { wave: 'square', vol: 0.11, hold: 0.78, pat:
        'G5 - E5 - C5 - E5 - G5 - - - C6 - - - ' +
        'B5 - A5 - G5 - A5 - B5 - - - C6 - - - ' +
        'A5 - F5 - D5 - F5 - A5 - - - D6 - - - ' +
        'G5 - B5 - D6 - B5 - G5 - - - - - . . ' },
      { wave: 'triangle', vol: 0.17, hold: 0.5, pat:
        'C3 . G3 . C3 . G3 . C3 . G3 . E3 . G3 . ' +
        'G2 . D3 . G2 . D3 . G2 . D3 . G2 . B3 . ' +
        'F2 . C3 . F2 . C3 . D3 . A3 . D3 . A3 . ' +
        'G2 . D3 . G2 . B3 . C3 . G3 . C3 . E3 . ' },
      { wave: 'sine', vol: 0.05, hold: 0.35, pat:
        '. . C6 . . . E6 . . . G6 . . . E6 . ' },
    ],
    drums: { len: 16, kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  },

  // 게임 오버: 한 번만 울리고 조용해지는 오락실식 징글.
  //
  // 원하셨던 마리오 게임오버 소리는 닌텐도 저작물이라 쓸 수 없어서,
  // 그 역할(짧게 툭 떨어지고 끝나는 패배 징글)에 맞춰 직접 만든 오리지널 곡입니다.
  // 실제 음원을 구하시면 assets/audio/gameover.mp3 로 넣으면 이 곡 대신 재생됩니다.
  gameover: {
    bpm: 100, steps: 32, once: true,     // once = 반복하지 않고 한 번만
    tracks: [
      // 반음씩 주르륵 미끄러져 내려오다가 힘없이 툭
      { wave: 'square', vol: 0.12, hold: 0.85, pat:
        'C5 - B4 - Bb4 - A4 - Ab4 - - - G4 - - - ' +
        'Eb4 - - - D4 - - - C4 - - - - - - - ' },
      { wave: 'triangle', vol: 0.17, hold: 0.9, pat:
        'C3 - - - - - - - Ab2 - - - - - - - ' +
        'G2 - - - - - - - C2 - - - - - - - ' },
      // 마지막에 낮게 깔리는 한숨
      { wave: 'sine', vol: 0.07, hold: 0.9, pat:
        '. . . . . . . . . . . . . . . . ' +
        '. . . . . . . . C3 - - - - - - - ' },
    ],
  },

  // --- 예전 게임 오버 음악 (느리게 반복되는 단조). 지우지 않고 남겨둡니다. ---
  // gameover_old: {
  //   bpm: 66, steps: 32,
  //   tracks: [
  //     { wave: 'square', vol: 0.11, hold: 0.9, pat:
  //       'A4 - - - G4 - - - F4 - - - E4 - - - ' +
  //       'D4 - - - C4 - - - B3 - - - A3 - - - ' },
  //     { wave: 'triangle', vol: 0.16, hold: 0.95, pat:
  //       'A2 - - - - - - - F2 - - - - - - - ' +
  //       'D2 - - - - - - - E2 - - - - - - - ' },
  //   ],
  // },
};

// ---------------------------------------------------------------- 기본 음원 생성

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = CFG.AUDIO_VOLUME;
  master.connect(ctx.destination);

  // 화이트 노이즈 버퍼 (효과음/드럼용)
  const len = Math.floor(ctx.sampleRate * 1.0);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  // 브라우저가 잠금을 풀어주거나(첫 입력), 탭을 다시 켜서 다시 살아났을 때
  // 틀어야 할 곡이 남아 있으면 그때 시작합니다.
  ctx.onstatechange = () => {
    if (ctx.state === 'running' && curName && !seq && !audioEl) playCurrent();
  };
  return ctx;
}

function tone(t, freq, dur, wave = 'square', vol = 0.15, slideTo = null) {
  if (!ctx || freq <= 0) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo && slideTo > 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function noise(t, dur, vol, filterType, f0, f1, q = 1) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 1;
  const filt = ctx.createBiquadFilter();
  filt.type = filterType;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(Math.max(40, f0), t);
  filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.03);
}

// ---------------------------------------------------------------- 시퀀서

function tokenize(pat) { return pat.trim().split(/\s+/); }

function tileTo(arr, len) {
  const out = [];
  while (out.length < len) out.push(...arr);
  return out.slice(0, len);
}

function compileTrack(track, steps) {
  const tk = tileTo(tokenize(track.pat), steps);
  const notes = [];
  for (let i = 0; i < tk.length; i++) {
    const t = tk[i];
    if (t === '.' || t === '-') continue;
    let n = 1;
    while (tk[i + n] === '-') n++;
    notes.push({ step: i, freq: noteFreq(t), len: n });
  }
  return { wave: track.wave, vol: track.vol, hold: track.hold ?? 0.85, notes };
}

function startSequencer(song) {
  const stepDur = 60 / song.bpm / 4;
  const tracks = song.tracks.map((t) => compileTrack(t, song.steps));
  seq = { song, stepDur, tracks, step: 0, next: ctx.currentTime + 0.08 };
  if (timer) clearInterval(timer);
  timer = setInterval(pump, 25);
  pump();
}

function pump() {
  if (!seq || !ctx) return;
  const horizon = ctx.currentTime + 0.25;
  let guard = 0;
  while (seq.next < horizon && guard++ < 200) {
    const s = seq.step;
    const t = seq.next;
    for (const tr of seq.tracks) {
      for (const n of tr.notes) {
        if (n.step !== s) continue;
        tone(t, n.freq, n.len * seq.stepDur * tr.hold, tr.wave, tr.vol);
      }
    }
    const d = seq.song.drums;
    if (d) {
      const b = s % (d.len || 16);
      if (d.kick.includes(b)) tone(t, 150, 0.13, 'sine', 0.38, 42);
      if (d.snare.includes(b)) noise(t, 0.13, 0.26, 'highpass', 900, 2400);
      if (d.hat.includes(b)) noise(t, 0.04, 0.07, 'highpass', 6000, 9000);
    }
    const wrapped = s + 1 >= seq.song.steps;
    seq.step = (s + 1) % seq.song.steps;
    seq.next += seq.stepDur;

    // once 곡(게임 오버 징글)은 한 바퀴만 울리고 조용해집니다
    if (wrapped && seq.song.once) {
      const mine = timer;
      seq = null;
      curName = null;     // 다 울렸으니 되살아나도 다시 틀지 않습니다
      setTimeout(() => { if (timer === mine) { clearInterval(timer); timer = null; } }, 2500);
      return;
    }
  }
}

function stopSequencer() {
  seq = null;
  if (timer) { clearInterval(timer); timer = null; }
}

/** 지금 울리고 있는 것을 모두 멈춥니다 (어떤 곡이었는지는 기억해 둡니다) */
function stopPlayback() {
  stopSequencer();
  if (audioEl) { audioEl.pause(); audioEl.src = ''; audioEl = null; }
}

/**
 * curName 에 적힌 곡을 실제로 틉니다.
 * 아직 오디오 잠금이 안 풀렸으면 조용히 false 를 돌려주고,
 * 잠금이 풀리는 순간 onstatechange 가 다시 불러줍니다.
 */
function playCurrent() {
  if (!curName) return false;

  // 내 음원 파일은 AudioContext 와 무관하게 재생됩니다
  if (overrides[curName]) {
    stopPlayback();
    audioEl = new Audio(overrides[curName]);
    audioEl.loop = LOOPING[curName] !== false;
    audioEl.volume = CFG.AUDIO_VOLUME;
    audioEl.play().catch(() => {});
    return true;
  }

  if (!ctx || ctx.state !== 'running') return false;
  const song = SONGS[curName];
  if (!song) return false;
  startSequencer(song);
  return true;
}

// ---------------------------------------------------------------- 효과음

function now() { return ctx ? ctx.currentTime + 0.001 : 0; }

const SFX = {
  // 타격음 5종 - 때릴 때마다 하나씩 랜덤으로 납니다
  puk() {                                     // 푹
    const t = now();
    noise(t, 0.07, 0.30, 'bandpass', 850, 220, 2.5);
    tone(t, 150, 0.06, 'square', 0.12, 55);
  },
  puck() {                                    // 퍽
    const t = now();
    noise(t, 0.09, 0.38, 'lowpass', 1900, 300);
    tone(t, 200, 0.07, 'square', 0.14, 60);
  },
  pushuk() {                                  // 푸슉
    const t = now();
    noise(t, 0.17, 0.24, 'highpass', 500, 4200);
  },
  ppihyung() {                                // 삐흉
    const t = now();
    tone(t, 760, 0.13, 'square', 0.13, 170);
  },
  shashak() {                                 // 샤샥
    const t = now();
    noise(t, 0.12, 0.26, 'bandpass', 3200, 700, 2);
    tone(t, 520, 0.08, 'triangle', 0.07, 900);
  },

  death() {                                   // 삐흉탁 (삐로디 처치)
    const t = now();
    tone(t, 880, 0.20, 'square', 0.16, 130);
    noise(t + 0.17, 0.14, 0.42, 'lowpass', 1400, 140);
    tone(t + 0.17, 110, 0.13, 'sine', 0.22, 44);
  },
  hurt() {                                    // 스톤이 아플 때
    const t = now();
    tone(t, 330, 0.22, 'sawtooth', 0.16, 90);
    noise(t, 0.1, 0.2, 'lowpass', 800, 200);
  },
  splash() {                                  // 시냇물
    const t = now();
    noise(t, 0.18, 0.14, 'bandpass', 2400, 900, 1.5);
  },
  move() {                                    // 메뉴 이동
    tone(now(), 620, 0.06, 'square', 0.10);
  },
  select() {                                  // 메뉴 결정
    const t = now();
    tone(t, 700, 0.07, 'square', 0.12);
    tone(t + 0.07, 1050, 0.11, 'square', 0.12);
  },
  deny() {                                    // 잠긴 항목
    const t = now();
    tone(t, 240, 0.10, 'square', 0.12);
    tone(t + 0.10, 180, 0.14, 'square', 0.12);
  },
  back() {                                    // 취소
    const t = now();
    tone(t, 480, 0.08, 'square', 0.10);
    tone(t + 0.08, 320, 0.12, 'square', 0.10);
  },
  clear() {                                   // 스테이지 클리어 팡파레
    const t = now();
    const mel = [523.25, 659.25, 783.99, 1046.5];
    mel.forEach((f, i) => {
      tone(t + i * 0.11, f, 0.16, 'square', 0.15);
      tone(t + i * 0.11, f / 2, 0.16, 'triangle', 0.10);
    });
    tone(t + 0.44, 1318.5, 0.45, 'square', 0.14);
  },
  win() {                                     // 전체 클리어
    const t = now();
    const mel = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    mel.forEach((f, i) => {
      tone(t + i * 0.13, f, 0.2, 'square', 0.15);
      tone(t + i * 0.13, f / 2, 0.2, 'triangle', 0.10);
    });
  },
  bossSiren() {                               // 최종 보스 등장 - 낮고 무거운 사이렌 3번
    const t = now();
    for (let i = 0; i < 3; i++) {
      const b = t + i * 0.62;
      tone(b, 220, 0.34, 'sawtooth', 0.13, 420);
      tone(b + 0.3, 420, 0.3, 'sawtooth', 0.13, 220);
      tone(b, 110, 0.6, 'triangle', 0.12);
      noise(b, 0.5, 0.08, 'lowpass', 500, 120);
    }
  },
  bossHit() {
    const t = now();
    noise(t, 0.1, 0.4, 'lowpass', 1200, 220);
    tone(t, 150, 0.1, 'square', 0.14, 70);
  },
  bossDown() {                                // 보스가 쓰러질 때
    const t = now();
    tone(t, 520, 0.5, 'square', 0.16, 90);
    tone(t + 0.1, 390, 0.55, 'triangle', 0.14, 70);
    noise(t + 0.35, 0.5, 0.4, 'lowpass', 900, 90);
    tone(t + 0.5, 80, 0.7, 'sine', 0.26, 30);
  },
  nukeWarn() {                                // 핵공격 경보 사이렌
    const t = now();
    for (let i = 0; i < 3; i++) {
      tone(t + i * 0.3, 440, 0.16, 'sawtooth', 0.11, 760);
      tone(t + i * 0.3 + 0.15, 760, 0.16, 'sawtooth', 0.11, 440);
    }
  },
  nukeBoom() {                                // 핵폭발
    const t = now();
    noise(t, 0.85, 0.5, 'lowpass', 3600, 70);
    tone(t, 95, 1.0, 'sine', 0.32, 26);
    tone(t, 62, 1.15, 'triangle', 0.28, 20);
    noise(t + 0.06, 0.55, 0.28, 'bandpass', 1400, 180, 1);
    noise(t + 0.3, 0.6, 0.16, 'lowpass', 700, 90);
  },
  nukeEmpty() {                               // 핵폭탄이 다 떨어졌을 때
    const t = now();
    tone(t, 200, 0.09, 'square', 0.10);
    tone(t + 0.1, 150, 0.14, 'square', 0.10);
  },
  stageStart() {
    const t = now();
    tone(t, 392, 0.1, 'square', 0.13);
    tone(t + 0.1, 523.25, 0.1, 'square', 0.13);
    tone(t + 0.2, 783.99, 0.22, 'square', 0.14);
  },
};

const HIT_SOUNDS = ['puk', 'puck', 'pushuk', 'ppihyung', 'shashak'];

// ---------------------------------------------------------------- 공개 API

export const Sound = {
  /** 내 음원 파일이 들어와 있는지 한 번 확인합니다 */
  async probeOverrides() {
    await Promise.all(Object.entries(OVERRIDE_NAMES).map(async ([key, base]) => {
      for (const ext of OVERRIDE_EXTS) {
        const url = `assets/audio/${base}.${ext}`;
        try {
          const res = await fetch(url, { method: 'HEAD' });
          if (res.ok) { overrides[key] = url; return; }
        } catch (_) { /* 다음 확장자 시도 */ }
      }
    }));

    // 어떤 곡이 파일이고 어떤 곡이 합성음인지 콘솔에 알려줍니다 (F12 로 확인)
    const label = { intro: '인트로', battle: '플레이 중', gameover: '게임 오버' };
    const lines = Object.keys(OVERRIDE_NAMES).map((k) => {
      const src = overrides[k] ? `내 음원 (${overrides[k]})` : '코드로 만든 8비트 음악';
      return `  ${label[k].padEnd(7)} : ${src}`;
    });
    console.log('[스톤 레인저] 배경음악\n' + lines.join('\n')
      + '\n  → 바꾸려면 assets/audio/ 에 intro / battle / gameover 이름으로'
      + ' mp3·ogg·wav·m4a 파일을 넣고 새로고침하세요.');
  },

  /** 이 곡이 내 음원 파일에서 나오는지 (아니면 코드로 만든 8비트 음악) */
  usingFile(name) { return !!overrides[name]; },

  /** 지금 배경음악이 실제로 울리고 있는지 */
  bgmActive() { return !!(seq || timer || (audioEl && !audioEl.paused)); },

  /**
   * 첫 키 입력 때 호출. 브라우저 자동재생 잠금을 풉니다.
   * ctx.resume() 은 비동기라서 반드시 끝난 뒤에 곡을 틀어야 합니다.
   * (바로 다음 줄에서 ctx.state 를 보면 아직 'suspended' 로 읽혀서 곡이 영영 안 나옵니다)
   */
  unlock() {
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(playCurrent).catch(() => {});
    } else {
      playCurrent();
    }
  },

  /** 배경음악 재생 (이미 그 곡이 울리고 있으면 다시 시작하지 않음) */
  bgm(name, force = false) {
    // 같은 곡이 "실제로 울리고 있을 때만" 건너뜁니다.
    // 아직 소리가 안 나고 있으면 이름이 같아도 다시 시도해야 합니다.
    if (!force && curName === name && this.bgmActive()) return;
    stopPlayback();
    curName = name;
    if (!ensureCtx()) return;
    playCurrent();     // 아직 잠겨 있으면 조용히 실패하고, 잠금이 풀릴 때 알아서 시작됩니다
  },

  stopBgm() {
    stopPlayback();
    curName = null;
  },

  /** 효과음 */
  sfx(name) {
    if (!ensureCtx() || ctx.state === 'suspended') return;
    const fn = SFX[name];
    if (fn) fn();
  },

  /** 타격음 랜덤 (푹/퍽/푸슉/삐흉/샤샥) */
  hitSfx() {
    this.sfx(HIT_SOUNDS[(Math.random() * HIT_SOUNDS.length) | 0]);
  },
};
