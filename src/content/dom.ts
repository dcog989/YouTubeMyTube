export function closestAcrossShadow(element: Element, selector: string): Element | null {
  let current: Element | null = element;
  while (current) {
    const match = current.closest(selector);
    if (match) return match;
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }
  return null;
}

export function forEachShadowRoot(
  root: ParentNode,
  visit: (shadow: ShadowRoot) => boolean | undefined,
): void {
  function visitElement(element: Element): boolean {
    const shadow = element.shadowRoot;
    if (!shadow) return true;
    if (visit(shadow) === false) return false;
    return iterate(shadow);
  }

  function iterate(node: ParentNode): boolean {
    if (node instanceof Element && !visitElement(node)) return false;
    for (const element of node.querySelectorAll('*')) {
      if (!visitElement(element)) return false;
    }
    return true;
  }

  iterate(root);
}

export function deepQuery<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T | null {
  const direct = root.querySelector<T>(selector);
  if (direct) return direct;

  let found: T | null = null;
  forEachShadowRoot(root, (shadow) => {
    found = shadow.querySelector<T>(selector);
    return found === null;
  });
  return found;
}
