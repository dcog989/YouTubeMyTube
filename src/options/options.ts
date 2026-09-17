import { mergeBlockTubeImport, parseBlockTubeBackup } from '../shared/blocktube';
import {
  compileRules,
  matchDirectNavigation,
  matchEntity,
  parseYouTubeUrl,
} from '../shared/matcher';
import { loadState, saveState } from '../shared/state';
import { defaultState, normalizeState } from '../shared/storage';
import type { AreaKey, BlockerState, Entity, FilterRules } from '../shared/types';

interface FilterListConfig {
  key: keyof FilterRules;
  title: string;
  help: string;
  placeholder: string;
}

interface AreaConfig {
  key: AreaKey;
  title: string;
  sub: string;
}

const FILTER_LISTS: FilterListConfig[] = [
  {
    key: 'videoIds',
    title: 'Video IDs',
    help: 'Exact 11-character IDs, one per line. Blocks direct access and hides matching cards.',
    placeholder: 'dQw4w9WgXcQ',
  },
  {
    key: 'titles',
    title: 'Video titles',
    help: 'Keywords or /regex/flags patterns, one per line. Matched against card titles.',
    placeholder: 'clickbait\n/\\bspoilers?\\b/i',
  },
  {
    key: 'channelIds',
    title: 'Channel IDs',
    help: 'Exact channel IDs starting with UC, one per line.',
    placeholder: 'UCxxxxxxxxxxxxxxxxxxxxxx',
  },
  {
    key: 'handles',
    title: 'Channel handles',
    help: 'Handle names without the @, one per line.',
    placeholder: 'somechannel',
  },
  {
    key: 'channelNames',
    title: 'Channel names',
    help: 'Keywords or /regex/flags patterns, one per line. Matched against channel text.',
    placeholder: 'Example Channel\n/\\bdrama\\b/i',
  },
  {
    key: 'commentAuthors',
    title: 'Comment authors',
    help: 'Keywords, channel IDs, handles, or /regex/flags patterns for comment authors.',
    placeholder: 'spammer',
  },
  {
    key: 'commentContents',
    title: 'Comment content',
    help: 'Keywords or /regex/flags patterns, one per line. Matched against comment text.',
    placeholder: '/free\\s+crypto/i',
  },
];

const AREAS: AreaConfig[] = [
  { key: 'homePage', title: 'Home page', sub: 'Redirect the YouTube home feed.' },
  { key: 'trendingPage', title: 'Trending page', sub: 'Redirect /feed/trending.' },
  { key: 'explorePage', title: 'Explore page', sub: 'Redirect /feed/explore.' },
  { key: 'subscriptionsPage', title: 'Subscriptions page', sub: 'Redirect /feed/subscriptions.' },
  { key: 'shortsPage', title: 'Shorts pages', sub: 'Redirect /shorts and direct Short links.' },
  { key: 'shortsShelf', title: 'Shorts shelves', sub: 'Hide Shorts carousels across the site.' },
  {
    key: 'commentsSection',
    title: 'Comments section',
    sub: 'Hide the comments area on watch pages.',
  },
  { key: 'liveChat', title: 'Live chat', sub: 'Hide the live chat frame.' },
  { key: 'relatedVideos', title: 'Related videos', sub: 'Hide the watch-page sidebar.' },
];

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

const editors = new Map<keyof FilterRules, HTMLTextAreaElement>();
const counters = new Map<keyof FilterRules, HTMLElement>();
const areaInputs = new Map<AreaKey, HTMLInputElement>();

const TEXTAREA_MIN_HEIGHT = 160;
const TEXTAREA_BOTTOM_GAP = 32;

let activeFilter: keyof FilterRules | null = null;
let saved: BlockerState = defaultState();
let draft: BlockerState = defaultState();

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

function activeRuleCount(items: string[]): number {
  return items.filter((item) => item && !item.startsWith('//')).length;
}

function isDirty(): boolean {
  return JSON.stringify(draft) !== JSON.stringify(saved);
}

function markDirty(): void {
  const dirty = isDirty();
  byId('dirty').hidden = !dirty;
  byId<HTMLButtonElement>('save').disabled = !dirty;
}

function applyTheme(preference: BlockerState['settings']['theme']): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
}

function updateCount(key: keyof FilterRules): void {
  const count = activeRuleCount(draft.rules[key]);
  const target = counters.get(key);
  if (target) target.textContent = count === 1 ? '1 rule' : `${count} rules`;
}

function autoGrowTextarea(textarea: HTMLTextAreaElement): void {
  const style = window.getComputedStyle(textarea);
  const border =
    Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
  textarea.style.height = 'auto';
  const contentHeight = textarea.scrollHeight + border;
  const top = textarea.getBoundingClientRect().top;
  const available = Math.max(TEXTAREA_MIN_HEIGHT, window.innerHeight - top - TEXTAREA_BOTTOM_GAP);
  textarea.style.height = `${Math.min(contentHeight, available)}px`;
  textarea.style.overflowY = contentHeight > available ? 'auto' : 'hidden';
}

function growActiveEditor(): void {
  if (!activeFilter) return;
  const textarea = editors.get(activeFilter);
  if (!textarea || textarea.offsetParent === null) return;
  autoGrowTextarea(textarea);
}

function selectPanel(name: string): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.panel === name);
  });
  document.querySelectorAll<HTMLElement>('.panel').forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === `panel-${name}`);
  });
  const navButton = document.querySelector<HTMLButtonElement>(`.nav-item[data-panel="${name}"]`);
  if (navButton) byId('panel-title').textContent = navButton.textContent ?? '';
  if (name === 'filters') growActiveEditor();
}

function selectFilter(key: keyof FilterRules): void {
  document.querySelectorAll<HTMLButtonElement>('.filter-nav-item').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.filter === key);
  });
  document.querySelectorAll<HTMLElement>('.editor-item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.filter === key);
  });
  activeFilter = key;
  growActiveEditor();
}

function buildFilters(): void {
  const nav = byId('filter-nav');
  const host = byId('filter-editors');

  FILTER_LISTS.forEach((config, index) => {
    const navButton = document.createElement('button');
    navButton.type = 'button';
    navButton.className = `filter-nav-item${index === 0 ? ' is-active' : ''}`;
    navButton.dataset.filter = config.key;
    navButton.textContent = config.title;
    navButton.addEventListener('click', () => selectFilter(config.key));
    nav.appendChild(navButton);

    const wrapper = document.createElement('div');
    wrapper.className = `editor-item${index === 0 ? ' is-active' : ''}`;
    wrapper.dataset.filter = config.key;
    if (index === 0) activeFilter = config.key;

    const head = document.createElement('div');
    head.className = 'editor-head';
    const label = document.createElement('label');
    label.className = 'row-title';
    label.htmlFor = `input-${config.key}`;
    label.textContent = config.title;
    const count = document.createElement('span');
    count.className = 'count';
    count.id = `count-${config.key}`;
    head.append(label, count);

    const help = document.createElement('p');
    help.className = 'help';
    help.textContent = config.help;

    const textarea = document.createElement('textarea');
    textarea.id = `input-${config.key}`;
    textarea.spellcheck = false;
    textarea.placeholder = config.placeholder;
    textarea.addEventListener('input', () => {
      draft.rules[config.key] = linesToArray(textarea.value);
      updateCount(config.key);
      markDirty();
      autoGrowTextarea(textarea);
    });

    wrapper.append(head, help, textarea);
    host.appendChild(wrapper);

    editors.set(config.key, textarea);
    counters.set(config.key, count);
  });
}

function buildAreas(): void {
  const host = byId('areas');
  for (const config of AREAS) {
    const row = document.createElement('div');
    row.className = 'row row-between';

    const left = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'row-title';
    title.textContent = config.title;
    const sub = document.createElement('div');
    sub.className = 'row-sub';
    sub.textContent = config.sub;
    left.append(title, sub);

    const label = document.createElement('label');
    label.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `area-${config.key}`;
    input.addEventListener('change', () => {
      draft.areas[config.key] = input.checked;
      markDirty();
    });
    const slider = document.createElement('span');
    slider.className = 'slider';
    label.append(input, slider);

    row.append(left, label);
    host.appendChild(row);
    areaInputs.set(config.key, input);
  }
}

function populate(): void {
  byId<HTMLSelectElement>('theme').value = draft.settings.theme;
  byId<HTMLInputElement>('enabled').checked = draft.settings.enabled;
  byId<HTMLInputElement>('block-message').value = draft.settings.blockMessage;

  for (const config of FILTER_LISTS) {
    const editor = editors.get(config.key);
    if (editor) editor.value = arrayToLines(draft.rules[config.key]);
    updateCount(config.key);
  }

  for (const [key, input] of areaInputs) {
    input.checked = draft.areas[key];
  }

  growActiveEditor();
}

function showResult(blocked: boolean | null, message: string): void {
  const result = byId('test-result');
  if (blocked === null) {
    result.hidden = true;
    return;
  }
  result.hidden = false;
  result.textContent = message;
  result.classList.toggle('is-blocked', blocked);
  result.classList.toggle('is-allowed', !blocked);
}

function pathnameOf(value: string): string {
  try {
    return new URL(value, 'https://www.youtube.com').pathname;
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
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'youtube-blocker-settings.json';
  anchor.click();
  URL.revokeObjectURL(url);
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
      showImportStatus('That file is not valid JSON.', false);
      return;
    }

    const blocktube = parseBlockTubeBackup(parsed);
    if (blocktube.ok) {
      const { state: merged, added } = mergeBlockTubeImport(draft, blocktube.data);
      draft = merged;
      populate();
      markDirty();
      const filters = `${added} new filter${added === 1 ? '' : 's'}`;
      const skipped = blocktube.data.skipped.length
        ? ` Skipped: ${blocktube.data.skipped.join(', ')}.`
        : '';
      showImportStatus(`Imported ${filters} from a BlockTube backup.${skipped}`, true);
      return;
    }

    if (isBlockerState(parsed)) {
      draft = normalizeState(parsed);
      populate();
      markDirty();
      showImportStatus('Imported YouTube Blocker settings.', true);
      return;
    }

    showImportStatus('That file is not a YouTube Blocker or BlockTube backup.', false);
  };
  reader.readAsText(file);
}

function showImportStatus(message: string, ok: boolean): void {
  const status = byId('import-status');
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle('is-allowed', ok);
  status.classList.toggle('is-blocked', !ok);
}

function wireStatic(): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((button) => {
    button.addEventListener('click', () => selectPanel(button.dataset.panel ?? 'general'));
  });

  byId<HTMLSelectElement>('theme').addEventListener('change', (event) => {
    draft.settings.theme = (event.target as HTMLSelectElement)
      .value as BlockerState['settings']['theme'];
    applyTheme(draft.settings.theme);
    markDirty();
  });

  byId<HTMLInputElement>('enabled').addEventListener('change', (event) => {
    draft.settings.enabled = (event.target as HTMLInputElement).checked;
    markDirty();
  });

  byId<HTMLInputElement>('block-message').addEventListener('input', (event) => {
    draft.settings.blockMessage = (event.target as HTMLInputElement).value;
    markDirty();
  });

  byId('save').addEventListener('click', () => {
    void (async () => {
      draft = normalizeState(draft);
      await saveState(draft);
      saved = structuredClone(draft);
      populate();
      markDirty();
    })();
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
    markDirty();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (draft.settings.theme === 'system') applyTheme('system');
  });

  window.addEventListener('resize', growActiveEditor);
}

async function init(): Promise<void> {
  saved = await loadState();
  draft = structuredClone(saved);
  buildFilters();
  buildAreas();
  wireStatic();
  applyTheme(draft.settings.theme);
  populate();
  markDirty();
  selectPanel('general');
}

void init();
