import { el } from './dom';

export interface KeypadHandlers {
  digit(d: string, at: number): void;
  back(): void;
}

// Keys fire on pointerdown, not click. It is about 100ms earlier, and this
// game measures answers in milliseconds.
// Libre Franklin has no U+232B, so the backspace key is drawn rather than typed.
function backspaceIcon(): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '26');
  svg.setAttribute('height', '26');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of ['M20 5H9.4L3 12l6.4 7H20a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z', 'm16 9.5-5 5', 'm11 9.5 5 5']) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function keypad(handlers: KeypadHandlers): HTMLElement {
  const pad = el('div', 'keypad');

  const key = (label: string | SVGElement, className: string, onPress: (at: number) => void) => {
    const button = el('button', className, typeof label === 'string' ? label : undefined);
    if (typeof label !== 'string') button.append(label);
    button.type = 'button';
    button.setAttribute('aria-label', typeof label === 'string' ? label : 'Backspace');
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();          // never let a tap become a click, or focus, or a zoom gesture
      const at = event.timeStamp || performance.now();
      button.classList.add('is-down');
      onPress(at);
    });
    const release = () => button.classList.remove('is-down');
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    return button;
  };

  for (let d = 1; d <= 9; d++) {
    pad.append(key(String(d), 'key', (at) => handlers.digit(String(d), at)));
  }
  pad.append(key('0', 'key key--wide', (at) => handlers.digit('0', at)));
  pad.append(key(backspaceIcon(), 'key key--util', () => handlers.back()));
  return pad;
}
