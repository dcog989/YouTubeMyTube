import { walkShadowRoots } from '../dom';
import { onAddedElements } from '../observer';

export type ElementListener = (element: Element) => void;

const observedRoots = new WeakSet<Node>();

export function observeRoot(root: Node, onElement: ElementListener): void {
  if (observedRoots.has(root)) return;
  observedRoots.add(root);
  onAddedElements(root, (nodes) => {
    for (const node of nodes) onElement(node);
  });
}

export function scanExisting(root: ParentNode, selector: string, onElement: ElementListener): void {
  root.querySelectorAll(selector).forEach(onElement);
}

function observeShadowTree(root: ParentNode, selector: string, onElement: ElementListener): void {
  walkShadowRoots(root, (_element, shadow) => {
    if (!shadow || observedRoots.has(shadow)) return;
    observeRoot(shadow, onElement);
    scanExisting(shadow, selector, onElement);
  });
}

export function attachShadows(owner: Element, selector: string, onElement: ElementListener): void {
  const root = owner.getRootNode();
  if (root instanceof ShadowRoot && !observedRoots.has(root)) {
    observeRoot(root, onElement);
    scanExisting(root, selector, onElement);
  }
  observeShadowTree(owner, selector, onElement);
  scanExisting(owner, selector, onElement);
}
