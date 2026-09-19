import { YOUTUBE_HOME } from '../shared/constants';
import { openOptionsPage, requestSync } from '../shared/ext';
import { loadState, saveState } from '../shared/state';
import { applyTheme } from '../shared/theme';
import {
  entityUrlForReason,
  reasonDetail,
  reasonLabel,
  removeRule,
  ruleRefForReason,
} from '../shared/unblock';

const FALLBACK_MESSAGE = 'This content is blocked.';

function reasonFromQuery(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('reason') ?? '';
}

async function render(): Promise<void> {
  const reason = reasonFromQuery();
  const state = await loadState();

  applyTheme(state.settings.theme);

  const title = document.getElementById('blocked-title');
  if (title) {
    title.textContent = reason ? reasonLabel(reason, FALLBACK_MESSAGE) : FALLBACK_MESSAGE;
  }

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
  const ref = reason ? ruleRefForReason(reason) : null;
  if (removeButton) {
    if (ref) {
      removeButton.addEventListener('click', () => {
        void (async () => {
          const current = await loadState();
          if (removeRule(current.rules, ref)) {
            await saveState(current);
            await requestSync();
          }
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
