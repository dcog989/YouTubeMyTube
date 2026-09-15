import { openOptionsPage, queryActiveTab } from '../shared/ext';
import { parseYouTubeUrl } from '../shared/matcher';
import { ruleCount } from '../shared/storage';
import { loadState, saveState } from '../shared/state';
import type { BlockerState } from '../shared/types';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

let state: BlockerState;
let activeVideoId: string | null = null;
let activeChannelId: string | null = null;
let activeHandle: string | null = null;

function applyTheme(): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const preference = state.settings.theme;
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
}

function renderCounts(): void {
  const { rules } = state;
  const parts: string[] = [];
  if (rules.videoIds.length) parts.push(`${rules.videoIds.length} video IDs`);
  if (rules.channelIds.length) parts.push(`${rules.channelIds.length} channel IDs`);
  if (rules.handles.length) parts.push(`${rules.handles.length} handles`);
  const keywords = rules.channelNames.length + rules.titles.length;
  if (keywords) parts.push(`${keywords} keyword filters`);
  const comments = rules.commentAuthors.length + rules.commentContents.length;
  if (comments) parts.push(`${comments} comment filters`);

  const counts = byId('counts');
  counts.textContent = parts.length > 0 ? parts.join(' · ') : 'No filters yet';
  counts.title = `${ruleCount(state)} total`;
}

function renderContext(): void {
  const context = byId('context');
  const videoButton = byId<HTMLButtonElement>('block-video');
  const channelButton = byId<HTMLButtonElement>('block-channel');

  const hasChannel = activeChannelId !== null || activeHandle !== null;
  if (!activeVideoId && !hasChannel) {
    context.hidden = true;
    return;
  }

  context.hidden = false;
  videoButton.hidden = activeVideoId === null;
  channelButton.hidden = !hasChannel;
  videoButton.disabled = activeVideoId !== null && state.rules.videoIds.includes(activeVideoId);
  channelButton.disabled =
    (activeChannelId !== null && state.rules.channelIds.includes(activeChannelId)) ||
    (activeHandle !== null && state.rules.handles.includes(activeHandle));
}

async function detectActiveTab(): Promise<void> {
  const tab = await queryActiveTab();
  if (!tab?.url) return;

  const parsed = parseYouTubeUrl(tab.url);
  const label = byId('context-label');
  if (parsed.videoId) {
    activeVideoId = parsed.videoId;
    label.textContent = `Video ${parsed.videoId}`;
  } else if (parsed.channelId) {
    activeChannelId = parsed.channelId;
    label.textContent = `Channel ${parsed.channelId}`;
  } else if (parsed.handle) {
    activeHandle = parsed.handle.toLowerCase();
    label.textContent = `Channel @${parsed.handle}`;
  }

  renderContext();
}

function registerHandlers(): void {
  byId<HTMLInputElement>('enabled').addEventListener('change', (event) => {
    state.settings.enabled = (event.target as HTMLInputElement).checked;
    void saveState(state);
  });

  byId('block-video').addEventListener('click', () => {
    if (!activeVideoId || state.rules.videoIds.includes(activeVideoId)) return;
    state.rules.videoIds.push(activeVideoId);
    renderCounts();
    renderContext();
    void saveState(state);
  });

  byId('block-channel').addEventListener('click', () => {
    if (activeChannelId && !state.rules.channelIds.includes(activeChannelId)) {
      state.rules.channelIds.push(activeChannelId);
    } else if (activeHandle && !state.rules.handles.includes(activeHandle)) {
      state.rules.handles.push(activeHandle);
    } else {
      return;
    }
    renderCounts();
    renderContext();
    void saveState(state);
  });

  byId('options').addEventListener('click', () => {
    openOptionsPage();
    window.close();
  });
}

async function init(): Promise<void> {
  state = await loadState();
  applyTheme();
  byId<HTMLInputElement>('enabled').checked = state.settings.enabled;
  renderCounts();
  registerHandlers();
  await detectActiveTab();
}

void init();
