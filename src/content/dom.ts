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

export function walkShadowRoots(
  root: ParentNode,
  visit: (element: Element, shadow: ShadowRoot | null) => boolean | undefined,
): void {
  function walkElement(element: Element): boolean {
    if (visit(element, element.shadowRoot) === false) return false;
    return element.shadowRoot ? walk(element.shadowRoot) : true;
  }

  function walk(node: ParentNode): boolean {
    if (node instanceof Element && !walkElement(node)) return false;
    for (const element of node.querySelectorAll('*')) {
      if (!walkElement(element)) return false;
    }
    return true;
  }

  walk(root);
}

export function forEachShadowRoot(
  root: ParentNode,
  visit: (shadow: ShadowRoot) => boolean | undefined,
): void {
  walkShadowRoots(root, (_element, shadow) => {
    if (!shadow) return true;
    return visit(shadow);
  });
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
