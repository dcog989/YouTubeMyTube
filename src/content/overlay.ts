import { YOUTUBE_HOME } from '../shared/constants';
import { t } from '../shared/i18n';
import type { Reason } from '../shared/reason';
import { reasonDetail } from '../shared/reason-copy';
import { unblockReason } from '../shared/rules-service';
import { getRuntimeUrl } from '../shared/runtime';
import { h } from '../shared/ui';
import { ruleRefForReason } from '../shared/unblock';
import { parseYouTubeUrl } from '../shared/url';
import { deepQuery } from './dom';
import type { PlaybackGuard, PlaybackLease } from './playback';

const OVERLAY_CLASS = 'ytb-block-overlay';
const VIDEO_BLANK_CLASS = 'ytb-blank-player';
const PASSIVE_COVER_CLASS = 'ytb-blank-cover-passive';
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

interface ChannelOverlayInfo {
  reason: Reason;
  name?: string;
  id?: string;
}

interface BlankCover {
  set(blanked: boolean, reason?: Reason): void;
  clear(): void;
}

interface ChannelOverlay {
  show(info: ChannelOverlayInfo): void;
  clear(): void;
}

interface Feedback {
  clear(): void;
}

function reasonKey(reason: Reason): string {
  return `${reason.kind}\u0000${reason.value}`;
}

function findPlayerBox(): HTMLElement | null {
  let fallback: HTMLElement | null = null;
  const consider = (found: HTMLElement | null): HTMLElement | null => {
    if (!found) return null;
    const rect = found.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return found;
    fallback ??= found;
    return null;
  };

  for (const selector of PLAYER_BOX_SELECTORS) {
    const found = consider(document.querySelector<HTMLElement>(selector));
    if (found) return found;
  }

  for (const selector of PLAYER_BOX_SELECTORS) {
    const found = consider(deepQuery<HTMLElement>(selector));
    if (found) return found;
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
    text: t('removeFromBlocklist'),
    hidden: ref === null,
  });
  remove.addEventListener('click', () => {
    void (async () => {
      if (!ref) return;
      // A failed or no-op removal must not reveal content that is still blocked.
      if (!(await unblockReason(reason))) return;
      feedback.clear();
    })();
  });

  const home = h('button', {
    type: 'button',
    className: 'ytb-block-btn ytb-block-home',
    text: t('youtubeHome'),
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
// feedback needs both to clear them; the consts close over each other, which is
// safe because clear only runs after both are initialized.
export function createOverlayFeedback(guard: PlaybackGuard): OverlayFeedback {
  const feedback: Feedback = {
    clear() {
      blank.clear();
      overlay.clear();
    },
  };

  const blank = createBlankCover({ guard, feedback });
  const overlay = createChannelOverlay({ guard, feedback });

  return {
    clear: feedback.clear,
    requestBlank: (blanked, reason) => blank.set(blanked, reason),
    clearChannel: () => overlay.clear(),
    showChannel: (info) => overlay.show(info),
  };
}

export function createBlankCover(options: {
  guard: PlaybackGuard;
  feedback: Feedback;
}): BlankCover {
  const { guard, feedback } = options;

  let cover: HTMLElement | null = null;
  let observer: ResizeObserver | null = null;
  let placeFrame = 0;
  let bodyFrame = 0;
  let playerBox: HTMLElement | null = null;
  let currentKey: string | null = null;
  let lease: PlaybackLease | null = null;

  function resolvePlayerBox(): HTMLElement | null {
    if (playerBox?.isConnected) return playerBox;
    const found = findPlayerBox();
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
    document.documentElement.classList.remove(VIDEO_BLANK_CLASS);
    lease?.release();
    lease = null;
    window.removeEventListener('resize', schedulePlace, true);
    window.removeEventListener('scroll', schedulePlace, true);
    if (bodyFrame !== 0) {
      cancelAnimationFrame(bodyFrame);
      bodyFrame = 0;
    }
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
      h('h2', { className: 'ytb-blank-title', text: t('overlayTitle') }),
      h('p', { className: 'ytb-blank-detail', text: reasonDetail(reason) }),
      buildActions(reason, feedback),
    );
  }

  // document_start can run before <body> exists; the class already hides the
  // video, so retry until the cover has a host instead of waiting for `load`.
  function retryWhenBody(reason?: Reason): void {
    if (bodyFrame !== 0) return;
    bodyFrame = requestAnimationFrame(() => {
      bodyFrame = 0;
      if (document.body) set(true, reason);
      else retryWhenBody(reason);
    });
  }

  function set(blanked: boolean, reason?: Reason): void {
    document.documentElement.classList.toggle(VIDEO_BLANK_CLASS, blanked);

    if (!blanked) {
      clear();
      return;
    }

    const key = reason ? reasonKey(reason) : null;
    const passive = parseYouTubeUrl(window.location.href).kind === 'shorts';
    if (cover) cover.classList.toggle(PASSIVE_COVER_CLASS, passive);
    if (cover?.isConnected && key !== null && currentKey === key) {
      // The player can appear after the first placement attempt; keep following it.
      watchBox();
      place();
      return;
    }

    lease ??= guard.acquire();

    if (!document.body) {
      retryWhenBody(reason);
      return;
    }

    if (!cover?.isConnected) {
      cover = h('div', { className: 'ytb-blank-cover' });
      cover.classList.toggle(PASSIVE_COVER_CLASS, passive);
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

function createChannelOverlay(options: {
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
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', t('overlayTitle'));
    const channel = channelLabel(info);

    root.append(buildLogo('ytb-block-logo'));
    root.append(h('h2', { className: 'ytb-block-title', text: t('overlayTitle') }));
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
    const action =
      root.querySelector<HTMLButtonElement>('.ytb-block-remove:not([hidden])') ??
      root.querySelector<HTMLButtonElement>('.ytb-block-home');
    action?.focus();
  }

  return { show, clear };
}
