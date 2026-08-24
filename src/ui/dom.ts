export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function frag(...nodes: Node[]): DocumentFragment {
  const f = document.createDocumentFragment();
  f.append(...nodes);
  return f;
}

// Restart a CSS animation that may already be running on this element.
export function replay(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

export const buzz = (ms: number): void => {
  try { navigator.vibrate?.(ms); } catch { /* unsupported, or blocked by policy */ }
};
