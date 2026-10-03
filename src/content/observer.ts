export interface ElementChange {
  added: Element[];
  changed: Element[];
}

type ChangeListener = (change: ElementChange) => void;
type AddedElementsListener = (nodes: Element[]) => void;

const OBSERVED_ATTRIBUTES = ['href', 'title', 'aria-label'];

const listeners = new WeakMap<Node, Set<ChangeListener>>();

function collectChanges(mutations: MutationRecord[]): ElementChange {
  const added: Element[] = [];
  const changed: Element[] = [];
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      let replacedText = false;
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) added.push(node as Element);
        else replacedText = true;
      });
      if (replacedText && mutation.target.nodeType === Node.ELEMENT_NODE) {
        changed.push(mutation.target as Element);
      }
      continue;
    }
    if (mutation.type === 'characterData') {
      const parent = mutation.target.parentElement;
      if (parent) changed.push(parent);
      continue;
    }
    if (mutation.target.nodeType === Node.ELEMENT_NODE) changed.push(mutation.target as Element);
  }
  return { added, changed };
}

function observe(root: Node, rootListeners: Set<ChangeListener>): void {
  const observer = new MutationObserver((mutations) => {
    const change = collectChanges(mutations);
    if (change.added.length === 0 && change.changed.length === 0) return;
    for (const subscriber of rootListeners) subscriber(change);
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: OBSERVED_ATTRIBUTES,
  });
}

export function onElementChanges(root: Node, listener: ChangeListener): void {
  let rootListeners = listeners.get(root);
  if (!rootListeners) {
    rootListeners = new Set();
    listeners.set(root, rootListeners);
    observe(root, rootListeners);
  }
  rootListeners.add(listener);
}

export function onAddedElements(root: Node, listener: AddedElementsListener): void {
  onElementChanges(root, (change) => {
    if (change.added.length > 0) listener(change.added);
  });
}
