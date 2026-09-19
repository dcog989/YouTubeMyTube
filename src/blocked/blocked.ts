import { YOUTUBE_HOME } from '../shared/constants';
import { entityUrlForReason } from '../shared/navigation';
import { parseReason, type Reason } from '../shared/reason';
import { reasonDetail, reasonLabel } from '../shared/reason-copy';
import { unblockReason } from '../shared/rules-service';
import { openOptionsPage, requestSync } from '../shared/runtime';
import { loadState } from '../shared/state';
import { applyTheme } from '../shared/theme';
import { ruleRefForReason } from '../shared/unblock';

const FALLBACK_MESSAGE = 'This content is blocked.';

function reasonFromQuery(): Reason | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('reason') ?? '';
  return raw ? parseReason(raw) : null;
}

async function render(): Promise<void> {
  const reason = reasonFromQuery();
  const state = await loadState();

  applyTheme(state.settings.theme);

  const title = document.getElementById('blocked-title');
  if (title) title.textContent = reasonLabel(reason, FALLBACK_MESSAGE);

  const detail = document.getElementById('blocked-detail');
  if (detail && reason) detail.textContent = reasonDetail(reason);

  const backButton = document.getElementById('blocked-back');
  backButton?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.replace(YOUTUBE_HOME);
  });

  document.getElementById('blocked-home')?.addEventListener('click', () => {
    window.location.replace(YOUTUBE_HOME);
  });

  const removeButton = document.getElementById('blocked-remove');
  const ref = ruleRefForReason(reason);
  if (removeButton) {
    if (ref) {
      removeButton.addEventListener('click', () => {
        void (async () => {
          if (await unblockReason(reason)) await requestSync();
          window.location.replace(entityUrlForReason(reason) ?? YOUTUBE_HOME);
        })();
      });
    } else {
      removeButton.hidden = true;
    }
  }

  document.getElementById('blocked-options')?.addEventListener('click', () => {
    openOptionsPage();
  });

  document.body.dataset.ready = 'true';
}

void render();
