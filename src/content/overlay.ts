import { YOUTUBE_HOME } from '../shared/constants';
import type { Reason } from '../shared/reason';
import { reasonDetail } from '../shared/reason-copy';
import { unblockReason } from '../shared/rules-service';
import { getRuntimeUrl } from '../shared/runtime';
import { h } from '../shared/ui';
import { ruleRefForReason } from '../shared/unblock';
import { deepQuery } from './dom';
import type { PlaybackGuard, PlaybackLease } from './playback';

const OVERLAY_CLASS = 'ytb-block-overlay';
const VIDEO_BLANK_CLASS = 'ytb-blank-player';
const LOGO_PATH = 'assets/icons/128.png';

const PLAYER_BOX_SELECTORS = [
  '#movie_player',
  '.html5-video-player',
  'video',
  '#player-container-inner',
  '#shorts-player',
  'ytd-shorts ytd-player',
  'ytd-reel-video-renderer[is-active] #player',
  '#shorts-container',
  '#player',
  'ytd-player',
];

export interface ChannelOverlayInfo {
  reason: Reason;
  name?: string;
  id?: string;
}

export interface BlankCover {
  set(blanked: boolean, reason?: Reason): void;
  clear(): void;
}

export interface ChannelOverlay {
  show(info: ChannelOverlayInfo): void;
  clear(): void;
}

export interface Feedback {
  clear(): void;
}

function reasonKey(reason: Reason): string {
  return `${reason.kind}\u0000${reason.value}`;
}

function findPlayerBox(): HTMLElement | null {
  let fallback: HTMLElement | null = null;
  for (const selector of PLAYER_BOX_SELECTORS) {
    const found = deepQuery(selector);
    if (!found) continue;
    const rect = found.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return found;
    fallback ??= found;
  }
  return fallback;
}

function buildLogo(className: string): HTMLImageElement {
  return h('img', { className, src: getRuntimeUrl(LOGO_PATH), alt: '' });
}

function buildActions(reason: Reason, feedback: Feedback): HTMLElement {
  const actions = h('div', { className: 'ytb-block-actions' });

  const ref = ruleRefForReason(reason);

  const remove = h('button', {
    type: 'button',
    className: 'ytb-block-btn ytb-block-btn-primary ytb-block-remove',
    text: 'Remove from blocklist',
    hidden: ref === null,
  });
  remove.addEventListener('click', () => {
    void (async () => {
      if (!ref) return;
      await unblockReason(reason);
      feedback.clear();
    })();
  });

  const home = h('button', {
    type: 'button',
    className: 'ytb-block-btn ytb-block-home',
    text: 'YouTube home',
  });
  home.addEventListener('click', () => {
    window.location.href = YOUTUBE_HOME;
  });

  actions.append(remove, home);
  return actions;
}

export interface OverlayFeedback extends Feedback {
  requestBlank(blanked: boolean, reason?: Reason): void;
  clearChannel(): void;
  showChannel(info: ChannelOverlayInfo): void;
}

// The cover and overlay need `feedback.clear` for their remove buttons, while
// feedback needs both to clear them; a shared holder breaks the cycle.
export function createOverlayFeedback(guard: PlaybackGuard): OverlayFeedback {
  let blank: BlankCover | null = null;
  let overlay: ChannelOverlay | null = null;

  const feedback: Feedback = {
    clear() {
      overlay?.clear();
      blank?.clear();
    },
  };

  blank = createBlankCover({ guard, feedback });
  overlay = createChannelOverlay({ guard, feedback });

  return {
    clear: feedback.clear,
    requestBlank: (blanked, reason) => blank?.set(blanked, reason),
    clearChannel: () => overlay?.clear(),
    showChannel: (info) => overlay?.show(info),
  };
}

export function createBlankCover(options: {
  guard: PlaybackGuard;
  feedback: Feedback;
  resolveBox?: () => HTMLElement | null;
}): BlankCover {
  const { guard, feedback } = options;
  const resolveBox = options.resolveBox ?? findPlayerBox;

  let cover: HTMLElement | null = null;
  let observer: ResizeObserver | null = null;
  let placeFrame = 0;
  let playerBox: HTMLElement | null = null;
  let currentKey: string | null = null;
  let lease: PlaybackLease | null = null;

  function resolvePlayerBox(): HTMLElement | null {
    if (playerBox?.isConnected) return playerBox;
    const found = resolveBox();
    playerBox = found && found.getBoundingClientRect().width > 0 ? found : null;
    return found;
  }

  function place(): void {
    if (!cover) return;
    const box = resolvePlayerBox();
    if (!box) return;
    const rect = box.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    cover.style.left = `${rect.left}px`;
    cover.style.top = `${rect.top}px`;
    cover.style.width = `${rect.width}px`;
    cover.style.height = `${rect.height}px`;
  }

  function schedulePlace(): void {
    if (placeFrame !== 0) return;
    placeFrame = requestAnimationFrame(() => {
      placeFrame = 0;
      place();
    });
  }

  function retryPlace(attempts: number): void {
    if (!cover) return;
    const box = resolvePlayerBox();
    if (box) place();
    if (box && box.getBoundingClientRect().width > 0) return;
    if (attempts <= 0) return;
    requestAnimationFrame(() => retryPlace(attempts - 1));
  }

  function watchBox(): void {
    observer?.disconnect();
    observer = null;
    const box = resolvePlayerBox();
    if (!box || typeof ResizeObserver === 'undefined') return;
    observer = new ResizeObserver(() => place());
    observer.observe(box);
  }

  function clear(): void {
    lease?.release();
    lease = null;
    window.removeEventListener('resize', schedulePlace, true);
    window.removeEventListener('scroll', schedulePlace, true);
    if (placeFrame !== 0) {
      cancelAnimationFrame(placeFrame);
      placeFrame = 0;
    }
    observer?.disconnect();
    observer = null;
    playerBox = null;
    currentKey = null;
    cover?.remove();
    cover = null;
  }

  function renderContent(reason: Reason): void {
    cover?.replaceChildren(
      buildLogo('ytb-blank-logo'),
      h('h2', { className: 'ytb-blank-title', text: 'Blocked by YouTubeMyTube' }),
      h('p', { className: 'ytb-blank-detail', text: reasonDetail(reason) }),
      buildActions(reason, feedback),
    );
  }

  function set(blanked: boolean, reason?: Reason): void {
    document.documentElement.classList.toggle(VIDEO_BLANK_CLASS, blanked);

    if (!blanked) {
      clear();
      return;
    }

    const key = reason ? reasonKey(reason) : null;
    if (cover?.isConnected && key !== null && currentKey === key) return;

    lease ??= guard.acquire();

    if (!document.body) return;

    if (!cover) {
      cover = h('div', { className: 'ytb-blank-cover' });
      document.body.appendChild(cover);
      window.addEventListener('resize', schedulePlace, true);
      window.addEventListener('scroll', schedulePlace, true);
      retryPlace(10);
    }

    if (reason) renderContent(reason);
    currentKey = key;
    watchBox();
    place();
  }

  return { set, clear };
}

export function createChannelOverlay(options: {
  guard: PlaybackGuard;
  feedback: Feedback;
}): ChannelOverlay {
  const { guard, feedback } = options;
  let overlay: HTMLElement | null = null;
  let currentKey = '';
  let lease: PlaybackLease | null = null;

  function clear(): void {
    lease?.release();
    lease = null;
    overlay?.remove();
    overlay = null;
    currentKey = '';
  }

  function channelLabel(info: ChannelOverlayInfo): string {
    const name = info.name?.trim() ?? '';
    const id = info.id?.trim() ?? '';
    if (name && id) return `${name} (${id})`;
    return name || id;
  }

  function build(info: ChannelOverlayInfo): HTMLElement {
    const root = h('div', { className: OVERLAY_CLASS });
    const channel = channelLabel(info);

    root.append(buildLogo('ytb-block-logo'));
    root.append(h('h2', { className: 'ytb-block-title', text: 'Blocked by YouTubeMyTube' }));
    if (channel) root.append(h('p', { className: 'ytb-block-channel', text: channel }));
    root.append(
      h('p', { className: 'ytb-block-detail', text: reasonDetail(info.reason) }),
      buildActions(info.reason, feedback),
    );
    return root;
  }

  function show(info: ChannelOverlayInfo): void {
    const host = document.body;
    if (!host) return;

    const key = `${reasonKey(info.reason)}|${info.name ?? ''}|${info.id ?? ''}`;
    if (overlay && currentKey === key && overlay.isConnected) return;
    clear();

    lease = guard.acquire();

    const root = build(info);
    host.appendChild(root);
    overlay = root;
    currentKey = key;
  }

  return { show, clear };
}
