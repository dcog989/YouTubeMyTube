type AddedElementsListener = (nodes: Element[]) => void;

const listeners = new WeakMap<Node, Set<AddedElementsListener>>();
const observers = new WeakMap<Node, MutationObserver>();

export function onAddedElements(root: Node, listener: AddedElementsListener): void {
  let rootListeners = listeners.get(root);
  if (!rootListeners) {
    rootListeners = new Set();
    listeners.set(root, rootListeners);
  }
  if (rootListeners.has(listener)) return;
  rootListeners.add(listener);

  if (observers.has(root)) return;

  const observer = new MutationObserver((mutations) => {
    const added: Element[] = [];
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) added.push(node as Element);
      });
    }
    if (added.length === 0) return;
    for (const subscriber of listeners.get(root) ?? []) subscriber(added);
  });
  observer.observe(root, { childList: true, subtree: true });
  observers.set(root, observer);
}
