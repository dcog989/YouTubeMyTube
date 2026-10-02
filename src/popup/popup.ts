import { CONTEXT_REQUEST } from '../shared/constants';
import { localizeDocument, t } from '../shared/i18n';
import { ruleCount, summarizeRules } from '../shared/normalize';
import { findChannel, hasVideoId } from '../shared/rules';
import { blockChannel, blockVideo, setEnabled } from '../shared/rules-service';
import { openOptionsPage } from '../shared/runtime';
import { loadState } from '../shared/state';
import { queryActiveTab, sendTabMessage } from '../shared/tabs';
import { applyTheme } from '../shared/theme';
import type { BlockerState, Entity } from '../shared/types';
import { byId } from '../shared/ui';
import { parseYouTubeUrl } from '../shared/url';

interface ActiveContext {
  videoId: string | null;
  channelId: string | null;
  handle: string | null;
  channelName: string | null;
}

let state: BlockerState;
let activeContext: ActiveContext = {
  videoId: null,
  channelId: null,
  handle: null,
  channelName: null,
};

function renderCounts(): void {
  const summary = summarizeRules(state);
  const parts: string[] = [];
  if (summary.videos) parts.push(t('popupCountVideos', String(summary.videos)));
  if (summary.channels) parts.push(t('popupCountChannels', String(summary.channels)));
  const keywords = summary.channelFilters + summary.titleFilters;
  if (keywords) parts.push(t('popupCountKeywords', String(keywords)));
  if (summary.commentFilters) parts.push(t('popupCountComments', String(summary.commentFilters)));

  const counts = byId('counts');
  counts.textContent = parts.length > 0 ? parts.join(' · ') : t('popupNoFilters');
  counts.title = t('popupTotal', String(ruleCount(state)));
}

function renderContext(): void {
  const context = byId('context');
  const videoButton = byId<HTMLButtonElement>('block-video');
  const channelButton = byId<HTMLButtonElement>('block-channel');

  const { videoId, channelId, handle } = activeContext;
  const hasChannel = channelId !== null || handle !== null;
  context.hidden = !videoId && !hasChannel;
  videoButton.disabled = videoId === null || hasVideoId(state.rules, videoId);
  const channel = findChannel(state.rules, { id: channelId, handle });
  channelButton.disabled = !hasChannel || channel !== undefined;
}

async function detectActiveTab(): Promise<void> {
  activeContext = { videoId: null, channelId: null, handle: null, channelName: null };

  const tab = await queryActiveTab();
  const parsed = tab?.url ? parseYouTubeUrl(tab.url) : { kind: 'other' as const };
  if (parsed.videoId) activeContext.videoId = parsed.videoId;
  if (parsed.channelId) activeContext.channelId = parsed.channelId;
  if (parsed.handle) activeContext.handle = parsed.handle.toLowerCase();

  if (tab?.id !== undefined && parsed.videoId) {
    const context = await sendTabMessage<Entity>(tab.id, { type: CONTEXT_REQUEST });
    if (context?.channelId && !activeContext.channelId) {
      activeContext.channelId = context.channelId;
    }
    if (context?.handle && !activeContext.handle) {
      activeContext.handle = context.handle.toLowerCase();
    }
    if (context?.channelName) activeContext.channelName = context.channelName;
  }

  const { videoId, channelId, handle } = activeContext;
  const label = byId('context-label');
  if (videoId) {
    label.textContent = t('contextVideo', videoId);
  } else if (channelId) {
    label.textContent = t('contextChannel', channelId);
  } else if (handle) {
    label.textContent = t('contextChannelHandle', handle);
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
    void applyMutation(setEnabled(enabled));
  });

  byId('block-video').addEventListener('click', () => {
    if (!activeContext.videoId) return;
    void applyMutation(blockVideo({ id: activeContext.videoId, title: '' }));
  });

  byId('block-channel').addEventListener('click', () => {
    const { channelId, handle, channelName } = activeContext;
    if (!channelId && !handle) return;
    void applyMutation(
      blockChannel({ id: channelId ?? '', name: channelName ?? '', handle: handle ?? '' }),
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
