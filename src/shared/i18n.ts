import enMessages from '../../_locales/en/messages.json';

type MessageEntry = { message: string };

const EN: Record<string, MessageEntry> = enMessages;

export type MessageKey = keyof typeof enMessages;

function applySubstitutions(message: string, substitutions?: string[]): string {
  if (!substitutions || substitutions.length === 0) return message;
  return message.replace(/\$(\d+)/g, (match, index: string) => {
    const value = substitutions[Number(index) - 1];
    return value ?? match;
  });
}

export function t(key: MessageKey | string, substitutions?: string | string[]): string {
  const subs =
    substitutions === undefined
      ? undefined
      : Array.isArray(substitutions)
        ? substitutions
        : [substitutions];
  const api = typeof chrome === 'undefined' ? undefined : chrome.i18n;
  const localized = api?.getMessage?.(key, subs);
  if (localized) return localized;
  const message = EN[key]?.message ?? key;
  return applySubstitutions(message, subs);
}

export function localizeDocument(root: ParentNode = document): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (key) element.textContent = t(key);
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    const spec = element.dataset.i18nAttr ?? '';
    for (const pair of spec.split(';')) {
      const [attribute, key] = pair.split(':');
      if (!attribute || !key) continue;
      element.setAttribute(attribute, t(key));
    }
  }
}
