import { defaultState } from '../shared/defaults';
import { localizeDocument, t } from '../shared/i18n';
import { normalizeState } from '../shared/normalize';
import { loadState, onLocalStorageChanged, saveState } from '../shared/state';
import { applyTheme, isTheme } from '../shared/theme';
import { byId } from '../shared/ui';
import { buildAreas, syncAreas } from './areas';
import { backfillMissing } from './backfill';
import { addChannel, renderChannels, wireChannelSort } from './channels';
import { setActivePanel, updateCounts } from './counts';
import { exportSettings, importSettings } from './data';
import { selectPanel } from './dom';
import { syncPatternEditors, wirePatternEditors } from './patterns';
import {
  commit,
  getDraft,
  handleExternalChange,
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
    button.classList.toggle('is-active', button.dataset.theme === theme);
  });
}

function populate(): void {
  syncThemeButtons();
  byId<HTMLInputElement>('enabled').checked = getDraft().settings.enabled;
  syncPatternEditors();
  syncAreas();
  renderChannels();
  renderVideos();
  updateCounts();
}

function selectPanelWithCounts(name: string): void {
  setActivePanel(name);
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
      commit(normalized);
      await saveState(normalized);
      setDirty(false);
      populate();
    })();
  });

  onLocalStorageChanged(handleExternalChange);
  byId('conflict-reload').addEventListener('click', reloadExternal);

  byId('test-url-btn').addEventListener('click', testUrl);
  byId('test-text-btn').addEventListener('click', testText);

  byId('export').addEventListener('click', exportSettings);

  const importFile = byId<HTMLInputElement>('import-file');
  byId('import').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files?.[0];
    if (file) importSettings(file);
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
}

async function init(): Promise<void> {
  localizeDocument();
  setDraft(await loadState());
  buildAreas();
  wirePatternEditors();
  wireStatic();
  subscribe(populate);
  applyTheme(getDraft().settings.theme);
  populate();
  setDirty(false);
  selectPanelWithCounts('channels');
  void backfillMissing().catch((error) => {
    console.error('Backfill failed', error);
  });
}

void init();
