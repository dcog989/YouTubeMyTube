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
  const iterate = (node: ParentNode): boolean => {
    const elements =
      node instanceof Element ? [node, ...node.querySelectorAll('*')] : node.querySelectorAll('*');
    for (const element of elements) {
      const shadow = element.shadowRoot;
      if (!shadow) continue;
      if (visit(shadow) === false) return false;
      if (!iterate(shadow)) return false;
    }
    return true;
  };
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
