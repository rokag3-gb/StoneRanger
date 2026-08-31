// 키보드 입력 - 여러 키를 동시에 눌러도 모두 인식합니다.

// 공격 키를 여러 개 두는 이유:
// 값싼 키보드는 한 번에 읽을 수 있는 키 수에 한계가 있어서(고스팅),
// 방향키 2개를 누른 채로 스페이스를 누르면 스페이스가 통째로 무시되는 경우가 많습니다.
// 키보드 회로상 스페이스와 떨어져 있는 Z / X / 숫자패드0 을 같이 열어두면
// 그중 하나는 반드시 먹힙니다.
export const ATTACK_KEYS = ['Space', 'KeyZ', 'KeyX', 'Numpad0'];

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Enter', 'NumpadEnter', 'Escape',
  ...ATTACK_KEYS,
]);

const down = new Set();      // 지금 눌려 있는 키
const pressed = new Set();   // 이번 프레임에 새로 눌린 키
const firstInputCbs = [];
let hadFirstInput = false;

function norm(code) {
  return code === 'NumpadEnter' ? 'Enter' : code;
}

window.addEventListener('keydown', (e) => {
  const code = norm(e.code);
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(code);
  down.add(code);
  fireFirstInput();
}, { passive: false });

window.addEventListener('keyup', (e) => {
  down.delete(norm(e.code));
});

// 창에서 포커스가 빠지면 눌린 키가 붙어버리지 않도록 정리
window.addEventListener('blur', () => { down.clear(); });

// 터치/클릭도 오디오 잠금 해제에 쓰입니다
window.addEventListener('pointerdown', fireFirstInput);

function fireFirstInput() {
  if (hadFirstInput) return;
  hadFirstInput = true;
  for (const cb of firstInputCbs) { try { cb(); } catch (_) {} }
  firstInputCbs.length = 0;
}

export const Input = {
  /** 지금 눌려 있는가 */
  isDown(code) { return down.has(code); },

  /** 이번 프레임에 새로 눌렸는가 (연타 감지용) */
  justPressed(code) { return pressed.has(code); },

  /** 방향 입력을 -1..1 벡터로 (대각선 동시 입력 지원) */
  axis() {
    let x = 0, y = 0;
    if (down.has('ArrowLeft')) x -= 1;
    if (down.has('ArrowRight')) x += 1;
    if (down.has('ArrowUp')) y -= 1;
    if (down.has('ArrowDown')) y += 1;
    return { x, y };
  },

  /** 공격 키 중 하나라도 이번 프레임에 새로 눌렸는가 */
  attackPressed() { return ATTACK_KEYS.some((k) => pressed.has(k)); },

  /** 공격 키 중 하나라도 눌려 있는가 (꾹 누르고 있어도 계속 공격됩니다) */
  attackDown() { return ATTACK_KEYS.some((k) => down.has(k)); },

  /** 매 프레임 마지막에 호출 - 새로 눌린 키 목록을 비웁니다 */
  endFrame() { pressed.clear(); },

  /** 첫 키 입력 때 한 번 실행 (브라우저 오디오 자동재생 정책 때문에 필요) */
  onFirstInput(cb) {
    if (hadFirstInput) cb();
    else firstInputCbs.push(cb);
  },

  get unlocked() { return hadFirstInput; },
};
