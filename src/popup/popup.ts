import { CONTEXT_REQUEST } from '../shared/constants';
import { localizeDocument, t } from '../shared/i18n';
import { ruleCount } from '../shared/normalize';
import { findChannel, hasVideoId } from '../shared/rules';
import {
  blockChannel,
  blockVideo,
  setEnabled,
  unblockChannel,
  unblockVideo,
} from '../shared/rules-service';
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
  title: string | null;
}

let state: BlockerState;
let activeContext: ActiveContext = {
  videoId: null,
  channelId: null,
  handle: null,
  channelName: null,
  title: null,
};

function renderCounts(): void {
  const total = ruleCount(state);
  byId('counts').textContent = total > 0 ? t('popupTotal', String(total)) : t('popupNoFilters');
}

function renderContext(): void {
  const context = byId('context');
  const videoButton = byId<HTMLButtonElement>('block-video');
  const channelButton = byId<HTMLButtonElement>('block-channel');

  const { videoId, channelId, handle, channelName } = activeContext;
  const hasChannel = channelId !== null || handle !== null || channelName !== null;
  context.hidden = !videoId && !hasChannel;
  videoButton.disabled = videoId === null;
  videoButton.textContent = t(
    videoId !== null && hasVideoId(state.rules, videoId) ? 'menuUnblockVideo' : 'popupBlockVideo',
  );
  const channel = findChannel(state.rules, { id: channelId, handle, name: channelName });
  channelButton.disabled = !hasChannel;
  channelButton.textContent = t(channel ? 'menuUnblockChannel' : 'popupBlockChannel');
}

async function detectActiveTab(): Promise<void> {
  activeContext = {
    videoId: null,
    channelId: null,
    handle: null,
    channelName: null,
    title: null,
  };

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
    if (context?.title) activeContext.title = context.title;
  }

  const { videoId, channelId, handle, channelName } = activeContext;
  const label = byId('context-label');
  if (videoId) {
    label.textContent = t('contextVideo', videoId);
  } else if (channelId) {
    label.textContent = t('contextChannel', channelId);
  } else if (handle) {
    label.textContent = t('contextChannelHandle', handle);
  } else if (channelName) {
    label.textContent = t('contextChannel', channelName);
  }

  renderContext();
}

async function applyMutation(mutation: Promise<BlockerState | null>): Promise<void> {
  const status = byId('status');
  const next = await mutation;
  if (!next) {
    byId<HTMLInputElement>('enabled').checked = state.settings.enabled;
    status.textContent = t('actionFailed');
    status.hidden = false;
    return;
  }
  status.textContent = '';
  status.hidden = true;
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
    const { videoId, title } = activeContext;
    if (!videoId) return;
    void applyMutation(
      hasVideoId(state.rules, videoId)
        ? unblockVideo(videoId)
        : blockVideo({ id: videoId, title: title ?? '' }),
    );
  });

  byId('block-channel').addEventListener('click', () => {
    const { channelId, handle, channelName } = activeContext;
    if (!channelId && !handle && !channelName) return;
    const lookup = { id: channelId, handle, name: channelName };
    void applyMutation(
      findChannel(state.rules, lookup)
        ? unblockChannel(lookup, activeContext.videoId ?? undefined)
        : blockChannel({ id: channelId ?? '', name: channelName ?? '', handle: handle ?? '' }),
    );
  });

  byId('options').addEventListener('click', () => {
    openOptionsPage();
    window.close();
  });
}

async function init(): Promise<void> {
  document.documentElement.lang = browser.i18n.getUILanguage();
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
