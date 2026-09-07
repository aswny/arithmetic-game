import { createSession } from '../game/session.js';
import { mulberry32 } from '../game/rng.js';
import type { Item, Profile, Session } from '../game/types';
import { el, replay, buzz } from './dom';
import { keypad } from './keypad';

const OP_GLYPH: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

const randomSeed = (): number => {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    return (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
  }
};

// Libre Franklin has no pause glyph, and the two-bar mark is small enough that
// a font fallback box would be conspicuous. Draw it, as with the backspace key.
function pauseIcon(): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'currentColor');
  for (const x of ['7', '14']) {
    const bar = document.createElementNS(ns, 'rect');
    bar.setAttribute('x', x);
    bar.setAttribute('y', '5');
    bar.setAttribute('width', '3');
    bar.setAttribute('height', '14');
    bar.setAttribute('rx', '1.5');
    svg.append(bar);
  }
  return svg;
}

const clock = (seconds: number): string => {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export interface SprintResult {
  session: Session;
}

export function sprintScreen(profile: Profile, onDone: (result: SprintResult) => void): HTMLElement {
  const session: Session = createSession(profile, mulberry32(randomSeed()));
  const durationS = session.cfg.durationS;

  const screen = el('div', 'screen sprint');
  const timer = el('div', 'timer');
  const fill = el('div', 'timer__fill');
  timer.append(fill);

  const head = el('div', 'sprint__head');
  const count = el('span', 'sprint__count', '0');
  const penalty = el('span', 'sprint__penalty');
  const pauseButton = el('button', 'iconbutton');
  pauseButton.type = 'button';
  pauseButton.setAttribute('aria-label', 'Pause');
  pauseButton.append(pauseIcon());
  pauseButton.addEventListener('click', () => pause());
  head.append(count, penalty, pauseButton);

  const stage = el('div', 'stage');
  const problem = el('div', 'problem');
  const entryRow = el('div', 'entry');
  stage.append(problem, entryRow);

  const pad = keypad({ digit: press, back: backspace });

  // The pause panel covers the stage as well as the keypad. Hiding the problem
  // is the point: a pause that left it on screen would be free thinking time
  // that the latency the engine measures would not include.
  const overlay = el('div', 'pause');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Paused');
  overlay.hidden = true;
  const panel = el('div', 'pause__panel');
  const pauseStat = el('p', 'pause__stat');
  const resumeButton = el('button', 'button', 'Resume');
  resumeButton.type = 'button';
  resumeButton.addEventListener('click', () => resume());
  const endButton = el('button', 'button button--quiet', 'End run');
  endButton.type = 'button';
  endButton.addEventListener('click', () => finish());
  panel.append(
    el('p', 'pause__title', 'Paused'),
    pauseStat,
    el('p', 'pause__note', 'The clock is stopped and the problem is hidden, so the pause neither costs you time nor buys you any.'),
    resumeButton,
    endButton,
  );
  overlay.append(panel);

  screen.append(timer, head, stage, pad, overlay);

  let current: Item | null = null;
  let entry = '';
  let shownAt = 0;
  let raf = 0;
  let finished = false;
  let paused = false;
  let pausedAt = 0;

  function renderProblem(item: Item): void {
    problem.replaceChildren(
      el('span', 'problem__num', String(item.a)),
      el('span', 'problem__op', OP_GLYPH[item.op] ?? item.op),
      el('span', 'problem__num problem__num--b', String(item.b)),
    );
    replay(stage, 'stage--enter');
  }

  function renderEntry(): void {
    const width = String(current?.answer ?? '').length;
    const slots = Array.from({ length: width }, (_, i) => {
      const slot = el('span', 'slot');
      if (i < entry.length) {
        slot.textContent = entry[i];
        slot.classList.add('slot--filled');
      }
      return slot;
    });
    entryRow.replaceChildren(...slots);
  }

  function present(): void {
    current = session.nextItem();
    entry = '';
    renderProblem(current);
    renderEntry();
    // Provisional, then corrected once the browser has actually painted this
    // item. The engine is a latency model, so timing from the state update
    // rather than the paint would bias every observation it ever learns from.
    shownAt = performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // A pause in the two frames before the correction lands would stamp the
      // item as shown at a moment nobody was looking at it. Keep the
      // provisional timestamp instead; `resume` will shift it either way.
      if (!paused && !finished) shownAt = performance.now();
    }));
  }

  function press(digit: string, at: number): void {
    if (!current || finished || paused) return;
    const width = String(current.answer).length;
    if (entry.length >= width) return;
    entry += digit;
    renderEntry();
    // Auto-submit: the answer commits the moment it is the right length.
    if (entry.length === width) commit(at);
  }

  function backspace(): void {
    if (!current || finished || paused || !entry) return;
    entry = entry.slice(0, -1);
    renderEntry();
  }

  function commit(at: number): void {
    if (!current) return;
    // `at` is the timestamp of the input event itself, so the measurement is
    // unaffected by how long rendering the next item takes.
    const rtMs = Math.max(1, at - shownAt);
    const correct = Number(entry) === current.answer;
    const outcome = session.submit({ correct, rtMs });
    count.textContent = String(outcome.solved);

    if (!correct) {
      replay(stage, 'stage--shake');
      replay(penalty, 'show');
      penalty.textContent = `−${outcome.penaltyS}s`;
      timer.classList.add('timer--hit');
      setTimeout(() => timer.classList.remove('timer--hit'), 260);
      buzz(28);
    }

    if (outcome.over) { finish(); return; }
    present();
  }

  // The clock keeps running while the player is thinking, so the elapsed time
  // is the session's committed total plus the current item's age. While
  // paused, that age is frozen at the moment the pause started.
  function remainingS(): number {
    const now = paused ? pausedAt : performance.now();
    const inFlight = shownAt ? (now - shownAt) / 1000 : 0;
    return Math.max(0, durationS - (session.elapsedS + inFlight));
  }

  function tick(): void {
    const remaining = remainingS();
    fill.style.transform = `scaleX(${remaining / durationS})`;
    if (remaining <= 0) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }

  function pause(): void {
    if (paused || finished) return;
    paused = true;
    pausedAt = performance.now();
    cancelAnimationFrame(raf);
    pauseStat.textContent = `${clock(remainingS())} left · ${session.solved} solved`;
    screen.classList.add('sprint--paused');
    overlay.hidden = false;
    resumeButton.focus();
  }

  function resume(): void {
    if (!paused || finished) return;
    paused = false;
    // The item's age is the latency the engine will be handed, so the paused
    // interval has to come back out of it: a pause must not read as thinking.
    shownAt += performance.now() - pausedAt;
    overlay.hidden = true;
    screen.classList.remove('sprint--paused');
    pauseButton.blur();
    raf = requestAnimationFrame(tick);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (paused) resume(); else pause();
    } else if (event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      press(event.key, event.timeStamp || performance.now());
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      backspace();
    }
  }

  function finish(): void {
    if (finished) return;
    finished = true;
    // The item on screen when the run ended was never answered, so it is not
    // submitted -- an unanswered item must not teach the model anything. That
    // holds whether the clock ran out or the player ended the run early.
    paused = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown);
    onDone({ session });
  }

  document.addEventListener('keydown', onKeyDown);
  present();
  raf = requestAnimationFrame(tick);
  return screen;
}
