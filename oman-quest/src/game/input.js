/**
 * One input state shared by the keyboard and the on-screen touch buttons.
 * `jumpPressed` / `downPressed` are edge flags: set on press, cleared by the
 * game loop after each frame.
 */
export const input = { left: false, right: false, jump: false, jumpPressed: false, downPressed: false };

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'down', KeyS: 'down',
};

export function press(action, down) {
  if (action === 'jump') {
    if (down && !input.jump) input.jumpPressed = true;
    input.jump = down;
  } else if (action === 'down') {
    if (down) input.downPressed = true;
  } else input[action] = down;
}

export function releaseAll() {
  input.left = input.right = input.jump = false;
  input.jumpPressed = input.downPressed = false;
}

/** Attach keyboard listeners; returns a cleanup function. */
export function bindKeyboard(onPause) {
  const isTyping = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
  const down = (e) => {
    if (isTyping(e)) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { onPause?.(); return; }
    const a = KEYS[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) press(a, true);
  };
  const up = (e) => { const a = KEYS[e.code]; if (a) press(a, false); };
  const blur = () => releaseAll();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
}
