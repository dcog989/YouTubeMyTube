import { byId } from '../shared/ui';

export function linesToArray(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function arrayToLines(items: string[]): string {
  return items.join('\n');
}

export function autoGrowTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function setStatus(id: string, message: string, ok: boolean): void {
  const target = byId(id);
  target.hidden = message === '';
  target.textContent = message;
  target.classList.toggle('is-allowed', ok);
  target.classList.toggle('is-blocked', !ok);
}

export function selectPanel(name: string): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.panel === name);
  });
  document.querySelectorAll<HTMLElement>('.panel').forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === `panel-${name}`);
  });
  const active = document.querySelector<HTMLElement>('.panel.is-active');
  active?.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(autoGrowTextarea);
  const navButton = document.querySelector<HTMLButtonElement>(`.nav-item[data-panel="${name}"]`);
  if (navButton) byId('panel-title').textContent = navButton.textContent ?? '';
}
