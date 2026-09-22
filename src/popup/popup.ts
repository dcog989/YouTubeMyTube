import { CONTEXT_REQUEST } from '../shared/constants';
import { localizeDocument, t } from '../shared/i18n';
import { ruleCount } from '../shared/normalize';
import { countActiveEntries } from '../shared/patterns';
import { findChannel, hasVideoId } from '../shared/rules';
import { blockChannel, blockVideo } from '../shared/rules-service';
import { openOptionsPage } from '../shared/runtime';
import { loadState, mutateState } from '../shared/state';
import { queryActiveTab, sendTabMessage } from '../shared/tabs';
import { applyTheme } from '../shared/theme';
import type { BlockerState, Entity } from '../shared/types';
import { byId } from '../shared/ui';
import { parseYouTubeUrl } from '../shared/url';

let state: BlockerState;
let activeVideoId: string | null = null;
let activeChannelId: string | null = null;
let activeHandle: string | null = null;
let activeChannelName: string | null = null;

function renderCounts(): void {
  const { rules } = state;
  const parts: string[] = [];
  if (rules.videos.length) parts.push(t('popupCountVideos', String(rules.videos.length)));
  if (rules.channels.length) parts.push(t('popupCountChannels', String(rules.channels.length)));
  const keywords =
    countActiveEntries(rules.channelFilters) + countActiveEntries(rules.titleFilters);
  if (keywords) parts.push(t('popupCountKeywords', String(keywords)));
  const comments = countActiveEntries(rules.commentFilters);
  if (comments) parts.push(t('popupCountComments', String(comments)));

  const counts = byId('counts');
  counts.textContent = parts.length > 0 ? parts.join(' · ') : t('popupNoFilters');
  counts.title = t('popupTotal', String(ruleCount(state)));
}

function renderContext(): void {
  const context = byId('context');
  const videoButton = byId<HTMLButtonElement>('block-video');
  const channelButton = byId<HTMLButtonElement>('block-channel');

  const hasChannel = activeChannelId !== null || activeHandle !== null;
  context.hidden = !activeVideoId && !hasChannel;
  videoButton.hidden = false;
  channelButton.hidden = false;
  videoButton.disabled = activeVideoId === null || hasVideoId(state.rules, activeVideoId);
  const channel = findChannel(state.rules, { id: activeChannelId, handle: activeHandle });
  channelButton.disabled = !hasChannel || channel !== undefined;
}

async function detectActiveTab(): Promise<void> {
  activeVideoId = null;
  activeChannelId = null;
  activeHandle = null;
  activeChannelName = null;

  const tab = await queryActiveTab();
  const parsed = tab?.url ? parseYouTubeUrl(tab.url) : { kind: 'other' as const };
  if (parsed.videoId) activeVideoId = parsed.videoId;
  if (parsed.channelId) activeChannelId = parsed.channelId;
  if (parsed.handle) activeHandle = parsed.handle.toLowerCase();

  if (tab?.id !== undefined && parsed.videoId) {
    const context = await sendTabMessage<Entity>(tab.id, { type: CONTEXT_REQUEST });
    if (context?.channelId && !activeChannelId) activeChannelId = context.channelId;
    if (context?.handle && !activeHandle) activeHandle = context.handle.toLowerCase();
    if (context?.channelName) activeChannelName = context.channelName;
  }

  const label = byId('context-label');
  if (activeVideoId) {
    label.textContent = t('contextVideo', activeVideoId);
  } else if (activeChannelId) {
    label.textContent = t('contextChannel', activeChannelId);
  } else if (activeHandle) {
    label.textContent = t('contextChannelHandle', activeHandle);
  }

  renderContext();
}

async function applyMutation(mutation: Promise<BlockerState | null>): Promise<void> {
  const next = await mutation;
  if (!next) return;
  state = next;
  renderCounts();
  renderContext();
}

function registerHandlers(): void {
  byId<HTMLInputElement>('enabled').addEventListener('change', (event) => {
    const enabled = (event.target as HTMLInputElement).checked;
    void mutateState((current) => {
      current.settings.enabled = enabled;
    });
  });

  byId('block-video').addEventListener('click', () => {
    if (!activeVideoId) return;
    void applyMutation(blockVideo({ id: activeVideoId, title: '' }));
  });

  byId('block-channel').addEventListener('click', () => {
    if (!activeChannelId && !activeHandle) return;
    void applyMutation(
      blockChannel({
        id: activeChannelId ?? '',
        name: activeChannelName ?? '',
        handle: activeHandle ?? '',
      }),
    );
  });

  byId('options').addEventListener('click', () => {
    openOptionsPage();
    window.close();
  });
}

async function init(): Promise<void> {
  localizeDocument();
  state = await loadState();
  applyTheme(state.settings.theme);
  byId<HTMLInputElement>('enabled').checked = state.settings.enabled;
  renderCounts();
  registerHandlers();
  await detectActiveTab();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void detectActiveTab();
  });
}

void init();
