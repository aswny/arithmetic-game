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
  head.append(count, penalty);

  const stage = el('div', 'stage');
  const problem = el('div', 'problem');
  const entryRow = el('div', 'entry');
  stage.append(problem, entryRow);

  const pad = keypad({ digit: press, back: backspace });
  screen.append(timer, head, stage, pad);

  let current: Item | null = null;
  let entry = '';
  let shownAt = 0;
  let raf = 0;
  let finished = false;

  function renderProblem(item: Item): void {
    problem.replaceChildren(
      el('span', undefined, String(item.a)),
      el('span', 'problem__op', OP_GLYPH[item.op] ?? item.op),
      el('span', undefined, String(item.b)),
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
    requestAnimationFrame(() => requestAnimationFrame(() => { shownAt = performance.now(); }));
  }

  function press(digit: string, at: number): void {
    if (!current || finished) return;
    const width = String(current.answer).length;
    if (entry.length >= width) return;
    entry += digit;
    renderEntry();
    // Auto-submit: the answer commits the moment it is the right length.
    if (entry.length === width) commit(at);
  }

  function backspace(): void {
    if (!current || finished || !entry) return;
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

  function tick(): void {
    // The clock keeps running while the player is thinking, so the elapsed
    // time is the session's committed total plus the current item's age.
    const inFlight = shownAt ? (performance.now() - shownAt) / 1000 : 0;
    const remaining = Math.max(0, durationS - (session.elapsedS + inFlight));
    fill.style.transform = `scaleX(${remaining / durationS})`;
    if (remaining <= 0) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key >= '0' && event.key <= '9') {
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
    // The item on screen when time ran out was never answered, so it is not
    // submitted -- an unanswered item must not teach the model anything.
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown);
    onDone({ session });
  }

  document.addEventListener('keydown', onKeyDown);
  present();
  raf = requestAnimationFrame(tick);
  return screen;
}
