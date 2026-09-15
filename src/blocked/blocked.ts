import { openOptionsPage } from '../shared/ext';
import { loadState } from '../shared/state';

const REASON_LABELS: Record<string, string> = {
  video: 'This video is blocked.',
  channel: 'This channel is blocked.',
  shorts: 'This Short is blocked.',
  handle: 'This channel is blocked.',
  area: 'This page is blocked.',
};

function reasonFromQuery(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('reason') ?? '';
}

function primaryLabel(reason: string): string | null {
  const key = reason.split(' ')[0] ?? '';
  return REASON_LABELS[key] ?? null;
}

async function render(): Promise<void> {
  const reason = reasonFromQuery();
  const label = primaryLabel(reason);
  const state = await loadState();

  const title = document.getElementById('blocked-title');
  if (title) {
    title.textContent = label ?? (state.settings.blockMessage || 'This content is blocked.');
  }

  const detail = document.getElementById('blocked-detail');
  if (detail && reason) detail.textContent = reason;

  const backButton = document.getElementById('blocked-back');
  backButton?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.replace('https://www.youtube.com/');
  });

  document.getElementById('blocked-home')?.addEventListener('click', () => {
    window.location.replace('https://www.youtube.com/');
  });

  document.getElementById('blocked-options')?.addEventListener('click', () => {
    openOptionsPage();
  });

  document.body.dataset.ready = 'true';
}

void render();
