import { AREA_DEFINITIONS } from '../shared/areas';
import { mergeBlockTubeImport, parseBlockTubeBackup } from '../shared/blocktube';
import { MAX_DNR_REGEX_RULES, YOUTUBE_ORIGIN } from '../shared/constants';
import { buildDnrRules } from '../shared/dnr';
import { onLocalStorageChanged } from '../shared/ext';
import { PATTERN_FILTERS, type PatternFilterKey } from '../shared/filters';
import {
  compileRules,
  countActiveEntries,
  matchDirectNavigation,
  matchEntity,
  parseYouTubeUrl,
} from '../shared/matcher';
import {
  type ChannelMeta,
  parseBlockInput,
  resolveChannel,
  resolveVideoTitle,
} from '../shared/resolve';
import {
  addChannel as addChannelRule,
  addVideo as addVideoRule,
  removeChannel,
  removeVideo,
} from '../shared/rules';
import { loadState, saveState } from '../shared/state';
import { defaultState, normalizeState } from '../shared/storage';
import { applyTheme, isTheme } from '../shared/theme';
import type { AreaKey, BlockerState, ChannelEntry, Entity, VideoEntry } from '../shared/types';
import { byId, h } from '../shared/ui';

const patternEditors = new Map<PatternFilterKey, HTMLTextAreaElement>();
const areaInputs = new Map<AreaKey, HTMLInputElement>();

const MAX_BACKFILL_LOOKUPS = 25;

const COUNTED_PANELS = ['channels', 'videos', 'comments', 'areas'] as const;
const COUNTED_PANEL_SET = new Set<string>(COUNTED_PANELS);

let draft: BlockerState = defaultState();
let activePanel = 'channels';
let dirty = false;
let savedSnapshot = '';
let externalState: BlockerState | null = null;

function linesToArray(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function arrayToLines(items: string[]): string {
  return items.join('\n');
}

function setDirty(value: boolean): void {
  dirty = value;
  byId('dirty').hidden = !value;
  byId<HTMLButtonElement>('save').disabled = !value;
}

function showConflict(): void {
  byId('conflict-warning').hidden = false;
}

function hideConflict(): void {
  byId('conflict-warning').hidden = true;
}

function adoptState(next: BlockerState): void {
  draft = next;
  savedSnapshot = JSON.stringify(draft);
  externalState = null;
  hideConflict();
  populate();
  setDirty(false);
}

function handleExternalChange(value: unknown): void {
  const incoming = normalizeState(value);
  if (JSON.stringify(incoming) === savedSnapshot) return;
  externalState = incoming;
  if (dirty) showConflict();
  else adoptState(incoming);
}

function panelFilterCount(panel: string): number {
  const rules = draft.rules;
  switch (panel) {
    case 'channels':
      return rules.channels.length + countActiveEntries(rules.channelFilters);
    case 'videos':
      return rules.videos.length + countActiveEntries(rules.titleFilters);
    case 'comments':
      return countActiveEntries(rules.commentFilters);
    case 'areas':
      return AREA_DEFINITIONS.filter((area) => draft.areas[area.key]).length;
    default:
      return 0;
  }
}

function formatCount(count: number): string {
  return count === 1 ? '1 filter' : `${count} filters`;
}

function updateCounts(): void {
  const isCounted = COUNTED_PANEL_SET.has(activePanel);
  byId('panel-count').textContent = isCounted ? formatCount(panelFilterCount(activePanel)) : '';
  const total = COUNTED_PANELS.reduce((sum, panel) => sum + panelFilterCount(panel), 0);
  byId('total-count').textContent = formatCount(total);
  updateDnrWarning();
}

function updateDnrWarning(): void {
  const notice = byId('dnr-warning');
  const { dropped } = buildDnrRules(draft);
  const noun = dropped === 1 ? 'filter' : 'filters';
  const verb = dropped === 1 ? 'exceeds' : 'exceed';
  notice.hidden = dropped === 0;
  notice.textContent =
    dropped === 0
      ? ''
      : `${dropped} ${noun} ${verb} the browser's ${MAX_DNR_REGEX_RULES}-rule limit and will be enforced in-page only.`;
}

function autoGrowTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function setStatus(id: string, message: string, ok: boolean): void {
  const target = byId(id);
  target.hidden = message === '';
  target.textContent = message;
  target.classList.toggle('is-allowed', ok);
  target.classList.toggle('is-blocked', !ok);
}

function selectPanel(name: string): void {
  activePanel = name;
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
  updateCounts();
}

function renderChannels(): void {
  const body = byId('channel-rows');
  body.replaceChildren();
  draft.rules.channels.forEach((channel) => {
    const idInput = h('input', {
      className: 'input entity-input',
      value: channel.id,
      placeholder: 'UC…',
      autocomplete: 'off',
    });
    idInput.addEventListener('input', () => {
      channel.id = idInput.value.trim();
      delete channel.lookupFailed;
      setDirty(true);
    });

    const remove = h('button', {
      type: 'button',
      className: 'btn btn-danger',
      text: 'Remove',
    });
    remove.addEventListener('click', () => {
      removeChannel(draft.rules, { id: channel.id, handle: channel.handle });
      renderChannels();
      setDirty(true);
    });

    body.appendChild(
      h(
        'tr',
        {},
        h('td', {}, idInput),
        h('td', { className: 'entity-readonly', text: channel.name || '—' }),
        h('td', {
          className: 'entity-readonly',
          text: channel.handle ? `@${channel.handle}` : '—',
        }),
        h('td', { className: 'col-action' }, remove),
      ),
    );
  });
  updateCounts();
}

function renderVideos(): void {
  const body = byId('video-rows');
  body.replaceChildren();
  draft.rules.videos.forEach((video) => {
    const idInput = h('input', {
      className: 'input entity-input',
      value: video.id,
      placeholder: '11-character ID',
      autocomplete: 'off',
    });
    idInput.addEventListener('input', () => {
      video.id = idInput.value.trim();
      delete video.lookupFailed;
      setDirty(true);
    });

    const remove = h('button', {
      type: 'button',
      className: 'btn btn-danger',
      text: 'Remove',
    });
    remove.addEventListener('click', () => {
      removeVideo(draft.rules, video.id);
      renderVideos();
      setDirty(true);
    });

    body.appendChild(
      h(
        'tr',
        {},
        h('td', {}, idInput),
        h('td', { className: 'entity-readonly', text: video.title || '—' }),
        h('td', { className: 'col-action' }, remove),
      ),
    );
  });
  updateCounts();
}

async function addChannel(): Promise<void> {
  const input = byId<HTMLInputElement>('channel-add');
  const parsed = parseBlockInput(input.value, 'channel');
  if (parsed?.kind !== 'channel') {
    setStatus('channel-status', 'Paste a channel URL, @handle, or UC channel ID.', false);
    return;
  }

  const id = parsed.channelId ?? '';
  const handle = parsed.handle ?? '';
  const entry: ChannelEntry = { id, name: '', handle };
  if (!addChannelRule(draft.rules, entry)) {
    setStatus('channel-status', 'That channel is already blocked.', false);
    return;
  }

  input.value = '';
  renderChannels();
  setDirty(true);
  setStatus('channel-status', 'Looking up channel details…', true);

  try {
    const meta = await resolveChannel({ id, handle });
    if (meta.id) entry.id = meta.id;
    if (meta.name) entry.name = meta.name;
    if (meta.handle) entry.handle = meta.handle;
    renderChannels();
    setDirty(true);
    setStatus('channel-status', entry.name ? `Added ${entry.name}.` : 'Channel added.', true);
  } catch {
    setStatus('channel-status', 'Channel added. Could not fetch details.', false);
  }
}

async function addVideo(): Promise<void> {
  const input = byId<HTMLInputElement>('video-add');
  const parsed = parseBlockInput(input.value, 'video');
  if (parsed?.kind !== 'video') {
    setStatus('video-status', 'Paste a video URL or an 11-character video ID.', false);
    return;
  }

  const entry: VideoEntry = { id: parsed.videoId, title: '' };
  if (!addVideoRule(draft.rules, entry)) {
    setStatus('video-status', 'That video is already blocked.', false);
    return;
  }

  input.value = '';
  renderVideos();
  setDirty(true);
  setStatus('video-status', 'Looking up title…', true);

  try {
    const title = await resolveVideoTitle(entry.id);
    if (title) entry.title = title;
    renderVideos();
    setDirty(true);
    setStatus('video-status', entry.title ? `Added ${entry.title}.` : 'Video added.', true);
  } catch {
    setStatus('video-status', 'Video added. Could not fetch title.', false);
  }
}

interface ChannelTarget {
  entry: ChannelEntry;
  id: string;
  handle: string;
}

interface VideoTarget {
  entry: VideoEntry;
  id: string;
}

function needsChannelBackfill(channel: ChannelEntry): boolean {
  return !channel.lookupFailed && !channel.name;
}

function needsVideoBackfill(video: VideoEntry): boolean {
  return !video.lookupFailed && !video.title;
}

async function backfillMissing(): Promise<void> {
  const channelTargets: ChannelTarget[] = draft.rules.channels
    .filter(needsChannelBackfill)
    .map((entry) => ({ entry, id: entry.id, handle: entry.handle }));
  const videoTargets: VideoTarget[] = draft.rules.videos
    .filter(needsVideoBackfill)
    .map((entry) => ({ entry, id: entry.id }));

  let changed = false;
  let lookups = 0;

  for (const target of channelTargets) {
    if (lookups >= MAX_BACKFILL_LOOKUPS) break;
    if (!draft.rules.channels.includes(target.entry)) continue;
    if (target.entry.id !== target.id || target.entry.handle !== target.handle) continue;
    lookups += 1;

    let meta: ChannelMeta | null = null;
    try {
      meta = await resolveChannel({ id: target.id, handle: target.handle });
    } catch {
      meta = null;
    }
    if (!meta) continue;

    if (meta.id && meta.id !== target.entry.id) {
      target.entry.id = meta.id;
      changed = true;
    }
    if (meta.name && meta.name !== target.entry.name) {
      target.entry.name = meta.name;
      changed = true;
    }
    if (meta.handle && meta.handle !== target.entry.handle) {
      target.entry.handle = meta.handle;
      changed = true;
    }

    if (meta.name) {
      if (target.entry.lookupFailed) {
        delete target.entry.lookupFailed;
        changed = true;
      }
    } else if (!target.entry.lookupFailed) {
      target.entry.lookupFailed = true;
      changed = true;
    }
  }

  for (const target of videoTargets) {
    if (lookups >= MAX_BACKFILL_LOOKUPS) break;
    if (!draft.rules.videos.includes(target.entry)) continue;
    if (target.entry.id !== target.id) continue;
    lookups += 1;

    let title: string | null = null;
    try {
      title = await resolveVideoTitle(target.id);
    } catch {
      title = null;
    }
    if (title === null) continue;

    if (title && title !== target.entry.title) {
      target.entry.title = title;
      changed = true;
    }

    if (title) {
      if (target.entry.lookupFailed) {
        delete target.entry.lookupFailed;
        changed = true;
      }
    } else if (!target.entry.lookupFailed) {
      target.entry.lookupFailed = true;
      changed = true;
    }
  }

  if (!changed) return;

  if (!dirty) {
    draft = normalizeState(draft);
    savedSnapshot = JSON.stringify(draft);
    await saveState(draft);
  }
  renderChannels();
  renderVideos();
}

function buildAreas(): void {
  const host = byId('areas');
  for (const config of AREA_DEFINITIONS) {
    const input = h('input', { type: 'checkbox', id: `area-${config.key}` });
    input.addEventListener('change', () => {
      draft.areas[config.key] = input.checked;
      setDirty(true);
      updateCounts();
    });

    host.appendChild(
      h(
        'div',
        { className: 'row row-between' },
        h(
          'div',
          {},
          h('div', { className: 'row-title', text: config.title }),
          h('div', { className: 'row-sub', text: config.sub }),
        ),
        h('label', { className: 'switch' }, input, h('span', { className: 'slider' })),
      ),
    );
    areaInputs.set(config.key, input);
  }
}

function wirePatternEditors(): void {
  for (const config of PATTERN_FILTERS) {
    const textarea = byId<HTMLTextAreaElement>(`input-${config.key}`);
    textarea.addEventListener('input', () => {
      draft.rules[config.key] = linesToArray(textarea.value);
      updateCounts();
      setDirty(true);
      autoGrowTextarea(textarea);
    });
    patternEditors.set(config.key, textarea);
  }
}

function syncThemeButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.theme === draft.settings.theme);
  });
}

function populate(): void {
  syncThemeButtons();
  byId<HTMLInputElement>('enabled').checked = draft.settings.enabled;

  for (const config of PATTERN_FILTERS) {
    const editor = patternEditors.get(config.key);
    if (editor) {
      editor.value = arrayToLines(draft.rules[config.key]);
      if (editor.offsetParent) autoGrowTextarea(editor);
    }
  }

  for (const [key, input] of areaInputs) {
    input.checked = draft.areas[key];
  }

  renderChannels();
  renderVideos();
  updateCounts();
}

function showResult(blocked: boolean | null, message: string): void {
  setStatus('test-result', blocked === null ? '' : message, !blocked);
}

function pathnameOf(value: string): string {
  try {
    return new URL(value, YOUTUBE_ORIGIN).pathname;
  } catch {
    return '/';
  }
}

function testUrl(): void {
  const value = byId<HTMLInputElement>('test-url').value.trim();
  if (!value) {
    showResult(null, '');
    return;
  }
  const parsed = parseYouTubeUrl(value);
  const compiled = compileRules(draft.rules);
  const result = matchDirectNavigation(parsed, pathnameOf(value), compiled, draft.areas);
  showResult(result.blocked, result.blocked ? `Blocked — ${result.reason}` : 'Not blocked');
}

function testText(): void {
  const type = byId<HTMLSelectElement>('test-type').value;
  const value = byId<HTMLInputElement>('test-text').value;
  if (!value) {
    showResult(null, '');
    return;
  }
  const entity: Entity = {};
  if (type === 'title') entity.title = value;
  else if (type === 'channelName') entity.channelName = value;
  else if (type === 'handle') entity.handle = value;
  else if (type === 'commentAuthor') entity.commentAuthor = value;
  else entity.commentContent = value;

  const result = matchEntity(entity, compileRules(draft.rules));
  showResult(result.blocked, result.blocked ? `Blocked — ${result.reason}` : 'Not blocked');
}

function exportSettings(): void {
  const blob = new Blob([JSON.stringify(normalizeState(draft), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = h('a', { href: url, download: 'YouTubeMyTube-settings.json' });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function isBlockerState(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return 'rules' in record || 'areas' in record || 'settings' in record;
}

function importSettings(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(reader.result));
    } catch {
      setStatus('import-status', 'That file is not valid JSON.', false);
      return;
    }

    const blocktube = parseBlockTubeBackup(parsed);
    if (blocktube.ok) {
      const { state: merged, added } = mergeBlockTubeImport(draft, blocktube.data);
      draft = merged;
      populate();
      setDirty(true);
      const filters = `${added} new filter${added === 1 ? '' : 's'}`;
      const skipped = blocktube.data.skipped.length
        ? ` Skipped: ${blocktube.data.skipped.join(', ')}.`
        : '';
      setStatus('import-status', `Imported ${filters} from a BlockTube backup.${skipped}`, true);
      return;
    }

    if (isBlockerState(parsed)) {
      draft = normalizeState(parsed);
      populate();
      setDirty(true);
      setStatus('import-status', 'Imported YouTubeMyTube settings.', true);
      return;
    }

    setStatus('import-status', 'That file is not a YouTubeMyTube or BlockTube backup.', false);
  };
  reader.readAsText(file);
}

function wireStatic(): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((button) => {
    button.addEventListener('click', () => selectPanel(button.dataset.panel ?? 'channels'));
  });

  document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.theme;
      if (!isTheme(theme)) return;
      draft.settings.theme = theme;
      applyTheme(theme);
      syncThemeButtons();
      setDirty(true);
    });
  });

  byId<HTMLInputElement>('enabled').addEventListener('change', (event) => {
    draft.settings.enabled = (event.target as HTMLInputElement).checked;
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

  byId('save').addEventListener('click', () => {
    void (async () => {
      draft = normalizeState(draft);
      savedSnapshot = JSON.stringify(draft);
      hideConflict();
      await saveState(draft);
      populate();
      setDirty(false);
    })();
  });

  onLocalStorageChanged(handleExternalChange);
  byId('conflict-reload').addEventListener('click', () => {
    if (externalState) adoptState(externalState);
    else hideConflict();
  });

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
    if (!confirm('Reset all settings and filters?')) return;
    draft = defaultState();
    populate();
    setDirty(true);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (draft.settings.theme === 'system') applyTheme('system');
  });
}

async function init(): Promise<void> {
  draft = await loadState();
  savedSnapshot = JSON.stringify(draft);
  buildAreas();
  wirePatternEditors();
  wireStatic();
  applyTheme(draft.settings.theme);
  populate();
  setDirty(false);
  selectPanel('channels');
  void backfillMissing().catch((error) => {
    console.error('Backfill failed', error);
  });
}

void init();
