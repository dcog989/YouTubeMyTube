export function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

export type UiChild = Node | string | number | null | undefined | false;

export interface UiProps {
  className?: string;
  text?: string | number;
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
  [key: string]: unknown;
}

function applyProp(element: HTMLElement, key: string, value: unknown): void {
  if (value === undefined || value === null || value === false) return;
  if (key === 'className') {
    element.className = String(value);
    return;
  }
  if (key === 'text') {
    element.textContent = String(value);
    return;
  }
  if (key === 'style' && typeof value === 'object') {
    Object.assign(element.style, value);
    return;
  }
  if (key === 'dataset' && typeof value === 'object') {
    Object.assign(element.dataset, value);
    return;
  }
  if (key in element) {
    (element as unknown as Record<string, unknown>)[key] = value;
    return;
  }
  element.setAttribute(key, String(value));
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: UiProps = {},
  ...children: UiChild[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) applyProp(element, key, value);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'string' || typeof child === 'number' ? String(child) : child);
  }
  return element;
}
