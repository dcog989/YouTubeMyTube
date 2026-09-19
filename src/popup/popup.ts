import { CONTEXT_REQUEST } from '../shared/constants';
import { openOptionsPage, queryActiveTab, sendTabMessage } from '../shared/ext';
import { countActiveEntries, parseYouTubeUrl } from '../shared/matcher';
import { addChannel, addVideo, findChannel, hasVideoId } from '../shared/rules';
import { loadState, saveState } from '../shared/state';
import { ruleCount } from '../shared/storage';
import { applyTheme } from '../shared/theme';
import type { BlockerState, Entity } from '../shared/types';
import { byId } from '../shared/ui';

let state: BlockerState;
let activeVideoId: string | null = null;
let activeChannelId: string | null = null;
let activeHandle: string | null = null;
let activeChannelName: string | null = null;

function renderCounts(): void {
  const { rules } = state;
  const parts: string[] = [];
  if (rules.videos.length) parts.push(`${rules.videos.length} videos`);
  if (rules.channels.length) parts.push(`${rules.channels.length} channels`);
  const keywords =
    countActiveEntries(rules.channelFilters) + countActiveEntries(rules.titleFilters);
  if (keywords) parts.push(`${keywords} keyword filters`);
  const comments = countActiveEntries(rules.commentFilters);
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
  videoButton.disabled = activeVideoId !== null && hasVideoId(state.rules, activeVideoId);
  const channel = findChannel(state.rules, { id: activeChannelId, handle: activeHandle });
  channelButton.disabled = hasChannel && channel !== undefined;
}

async function detectActiveTab(): Promise<void> {
  const tab = await queryActiveTab();
  if (!tab?.url) return;

  const parsed = parseYouTubeUrl(tab.url);
  if (parsed.videoId) activeVideoId = parsed.videoId;
  if (parsed.channelId) activeChannelId = parsed.channelId;
  if (parsed.handle) activeHandle = parsed.handle.toLowerCase();

  if (tab.id !== undefined && parsed.videoId) {
    const context = await sendTabMessage<Entity>(tab.id, { type: CONTEXT_REQUEST });
    if (context?.channelId && !activeChannelId) activeChannelId = context.channelId;
    if (context?.handle && !activeHandle) activeHandle = context.handle.toLowerCase();
    if (context?.channelName) activeChannelName = context.channelName;
  }

  const label = byId('context-label');
  if (activeVideoId) {
    label.textContent = `Video ${activeVideoId}`;
  } else if (activeChannelId) {
    label.textContent = `Channel ${activeChannelId}`;
  } else if (activeHandle) {
    label.textContent = `Channel @${activeHandle}`;
  }

  renderContext();
}

function registerHandlers(): void {
  byId<HTMLInputElement>('enabled').addEventListener('change', (event) => {
    state.settings.enabled = (event.target as HTMLInputElement).checked;
    void saveState(state);
  });

  byId('block-video').addEventListener('click', () => {
    if (!activeVideoId) return;
    if (!addVideo(state.rules, { id: activeVideoId, title: '' })) return;
    renderCounts();
    renderContext();
    void saveState(state);
  });

  byId('block-channel').addEventListener('click', () => {
    if (!activeChannelId && !activeHandle) return;
    const added = addChannel(state.rules, {
      id: activeChannelId ?? '',
      name: activeChannelName ?? '',
      handle: activeHandle ?? '',
    });
    if (!added) return;
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
  applyTheme(state.settings.theme);
  byId<HTMLInputElement>('enabled').checked = state.settings.enabled;
  renderCounts();
  registerHandlers();
  await detectActiveTab();
}

void init();
