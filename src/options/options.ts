import { defaultState } from '../shared/defaults';
import { localizeDocument, t } from '../shared/i18n';
import { normalizeState } from '../shared/normalize';
import { completeOnboarding } from '../shared/rules-service';
import { requestMutation } from '../shared/runtime';
import { onLocalStorageChanged, readState } from '../shared/state';
import { applyTheme, isTheme } from '../shared/theme';
import type { BlockerState } from '../shared/types';
import { byId } from '../shared/ui';
import { buildAreas, syncAreas } from './areas';
import { backfillMissing } from './backfill';
import { addChannel, renderChannels, wireChannelSort } from './channels';
import { updateCounts } from './counts';
import { exportSettings, importSettings, renderBackup, restoreBackup } from './data';
import { selectPanel, setStatus } from './dom';
import { syncPatternEditors, wirePatternEditors } from './patterns';
import {
  beginSave,
  commit,
  discardChanges,
  failSave,
  finishSave,
  getDraft,
  handleExternalChange,
  isDirty,
  notify,
  reloadExternal,
  setDirty,
  setDraft,
  subscribe,
} from './state';
import { testText, testUrl } from './tester';
import { addVideo, renderVideos, wireVideoSort } from './videos';

function syncThemeButtons(): void {
  const theme = getDraft().settings.theme;
  document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((button) => {
    const active = button.dataset.theme === theme;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function populate(): void {
  applyTheme(getDraft().settings.theme);
  syncThemeButtons();
  syncOnboarding();
  byId<HTMLInputElement>('enabled').checked = getDraft().settings.enabled;
  syncPatternEditors();
  syncAreas();
  renderChannels();
  renderVideos();
  updateCounts();
}

function syncOnboarding(): void {
  byId('onboarding').hidden = getDraft().settings.onboardingComplete;
}

function dismissOnboarding(): void {
  getDraft().settings.onboardingComplete = true;
  syncOnboarding();
  void completeOnboarding();
}

function selectPanelWithCounts(name: string): void {
  selectPanel(name);
  updateCounts();
}

function wireStatic(): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((button) => {
    button.addEventListener('click', () =>
      selectPanelWithCounts(button.dataset.panel ?? 'channels'),
    );
  });

  document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.theme;
      if (!isTheme(theme)) return;
      getDraft().settings.theme = theme;
      applyTheme(theme);
      syncThemeButtons();
      setDirty(true);
    });
  });

  byId<HTMLInputElement>('enabled').addEventListener('change', (event) => {
    getDraft().settings.enabled = (event.target as HTMLInputElement).checked;
    setDirty(true);
  });

  byId('onboarding-dismiss').addEventListener('click', dismissOnboarding);

  byId('channel-add-btn').addEventListener('click', () => void addChannel());
  byId<HTMLInputElement>('channel-add').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void addChannel();
  });
  byId('video-add-btn').addEventListener('click', () => void addVideo());
  byId<HTMLInputElement>('video-add').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void addVideo();
  });

  wireChannelSort(renderChannels);
  wireVideoSort(renderVideos);

  byId('save').addEventListener('click', () => {
    void (async () => {
      const normalized = normalizeState(getDraft());
      const saveButton = byId<HTMLButtonElement>('save');
      saveButton.disabled = true;
      byId<HTMLButtonElement>('discard').disabled = true;
      beginSave();
      const saved = await requestMutation({ kind: 'replaceState', state: normalized });
      if (!saved) {
        failSave();
        setDirty(true);
        setStatus('save-status', t('saveFailed'), false);
        return;
      }
      setStatus('save-status', '', true);
      setDirty(!finishSave(saved));
      populate();
    })();
  });

  byId('discard').addEventListener('click', discardChanges);

  onLocalStorageChanged(handleExternalChange);
  byId('conflict-reload').addEventListener('click', reloadExternal);

  byId('test-url-btn').addEventListener('click', testUrl);
  byId('test-text-btn').addEventListener('click', testText);

  byId('export').addEventListener('click', exportSettings);
  byId('restore-backup').addEventListener('click', () => void restoreBackup());

  const importFile = byId<HTMLInputElement>('import-file');
  byId('import').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files?.[0];
    if (file) void importSettings(file);
    importFile.value = '';
  });

  byId('reset').addEventListener('click', () => {
    if (!confirm(t('confirmReset'))) return;
    setDraft(defaultState());
    notify();
    setDirty(true);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getDraft().settings.theme === 'system') applyTheme('system');
  });

  window.addEventListener('beforeunload', (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

async function init(): Promise<void> {
  document.documentElement.lang = browser.i18n.getUILanguage();
  localizeDocument();
  let initial: BlockerState;
  try {
    initial = (await readState()) ?? defaultState();
  } catch (error) {
    // Saving an empty fallback would replace the stored rules; stay read-only.
    console.error('YouTubeMyTube: failed to load saved settings', error);
    setStatus('save-status', t('loadFailed'), false);
    return;
  }
  commit(initial);
  buildAreas();
  wirePatternEditors();
  wireStatic();
  subscribe(populate);
  populate();
  setDirty(false);
  selectPanelWithCounts('channels');
  void backfillMissing().catch((error) => {
    console.error('Backfill failed', error);
  });
  void renderBackup();
}

void init();
