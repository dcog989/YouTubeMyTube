type AddedElementsListener = (nodes: Element[]) => void;

const listeners = new WeakMap<Node, Set<AddedElementsListener>>();

function observe(root: Node, rootListeners: Set<AddedElementsListener>): void {
  const observer = new MutationObserver((mutations) => {
    const added: Element[] = [];
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) added.push(node as Element);
      });
    }
    if (added.length === 0) return;
    for (const subscriber of rootListeners) subscriber(added);
  });
  observer.observe(root, { childList: true, subtree: true });
}

export function onAddedElements(root: Node, listener: AddedElementsListener): void {
  let rootListeners = listeners.get(root);
  if (!rootListeners) {
    rootListeners = new Set();
    listeners.set(root, rootListeners);
    observe(root, rootListeners);
  }
  rootListeners.add(listener);
}
