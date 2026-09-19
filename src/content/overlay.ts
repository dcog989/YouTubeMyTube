import { YOUTUBE_HOME } from '../shared/constants';
import { type Reason, reasonDetail } from '../shared/reason';
import { unblockReason } from '../shared/rules-service';
import { getRuntimeUrl } from '../shared/runtime';
import { h } from '../shared/ui';
import { ruleRefForReason } from '../shared/unblock';
import { deepQuery } from './dom';

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

let overlay: HTMLElement | null = null;
let blankCover: HTMLElement | null = null;
let blankObserver: ResizeObserver | null = null;
let placeFrame = 0;
let playerBox: HTMLElement | null = null;
let currentKey = '';
let currentBlankKey: string | null = null;

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

function resolvePlayerBox(): HTMLElement | null {
  if (playerBox?.isConnected) return playerBox;
  const found = findPlayerBox();
  playerBox = found && found.getBoundingClientRect().width > 0 ? found : null;
  return found;
}

function placeCover(): void {
  if (!blankCover) return;
  const box = resolvePlayerBox();
  if (!box) return;
  const rect = box.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  blankCover.style.left = `${rect.left}px`;
  blankCover.style.top = `${rect.top}px`;
  blankCover.style.width = `${rect.width}px`;
  blankCover.style.height = `${rect.height}px`;
}

function schedulePlaceCover(): void {
  if (placeFrame !== 0) return;
  placeFrame = requestAnimationFrame(() => {
    placeFrame = 0;
    placeCover();
  });
}

function retryPlace(attempts: number): void {
  if (!blankCover) return;
  const box = resolvePlayerBox();
  if (box) placeCover();
  if (box && box.getBoundingClientRect().width > 0) return;
  if (attempts <= 0) return;
  requestAnimationFrame(() => retryPlace(attempts - 1));
}

function watchCoverBox(): void {
  blankObserver?.disconnect();
  blankObserver = null;
  const box = resolvePlayerBox();
  if (!box || typeof ResizeObserver === 'undefined') return;
  blankObserver = new ResizeObserver(() => placeCover());
  blankObserver.observe(box);
}

function removeBlankCover(): void {
  document.removeEventListener('play', pauseVideo, true);
  window.removeEventListener('resize', schedulePlaceCover, true);
  window.removeEventListener('scroll', schedulePlaceCover, true);
  if (placeFrame !== 0) {
    cancelAnimationFrame(placeFrame);
    placeFrame = 0;
  }
  blankObserver?.disconnect();
  blankObserver = null;
  playerBox = null;
  currentBlankKey = null;
  blankCover?.remove();
  blankCover = null;
}

function pauseVideo(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLVideoElement) target.pause();
}

function pauseAll(): void {
  document.querySelectorAll('video').forEach((video) => {
    video.pause();
  });
}

export function setPlayerBlank(blanked: boolean, reason?: Reason): void {
  document.documentElement.classList.toggle(VIDEO_BLANK_CLASS, blanked);

  if (!blanked) {
    removeBlankCover();
    return;
  }

  const key = reason ? reasonKey(reason) : null;
  if (blankCover?.isConnected && key !== null && currentBlankKey === key) return;

  document.addEventListener('play', pauseVideo, true);
  pauseAll();

  if (!document.body) return;

  if (!blankCover) {
    blankCover = h('div', { className: 'ytb-blank-cover' });
    document.body.appendChild(blankCover);
    window.addEventListener('resize', schedulePlaceCover, true);
    window.addEventListener('scroll', schedulePlaceCover, true);
    retryPlace(10);
  }

  if (reason) renderBlankContent(blankCover, reason);
  currentBlankKey = key;
  watchCoverBox();
  placeCover();
}

export function clearChannelOverlay(): void {
  document.removeEventListener('play', pauseVideo, true);
  overlay?.remove();
  overlay = null;
  currentKey = '';
}

export function clearFeedback(): void {
  clearChannelOverlay();
  setPlayerBlank(false);
}

function channelLabel(info: ChannelOverlayInfo): string {
  const name = info.name?.trim() ?? '';
  const id = info.id?.trim() ?? '';
  if (name && id) return `${name} (${id})`;
  return name || id;
}

function buildLogo(className: string): HTMLImageElement {
  return h('img', { className, src: getRuntimeUrl(LOGO_PATH), alt: '' });
}

function buildActions(reason: Reason): HTMLElement {
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
      clearFeedback();
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

function buildOverlay(info: ChannelOverlayInfo): HTMLElement {
  const root = h('div', { className: OVERLAY_CLASS });
  const channel = channelLabel(info);

  root.append(buildLogo('ytb-block-logo'));
  root.append(h('h2', { className: 'ytb-block-title', text: 'Blocked by YouTubeMyTube' }));
  if (channel) root.append(h('p', { className: 'ytb-block-channel', text: channel }));
  root.append(
    h('p', { className: 'ytb-block-detail', text: reasonDetail(info.reason) }),
    buildActions(info.reason),
  );
  return root;
}

function renderBlankContent(cover: HTMLElement, reason: Reason): void {
  cover.replaceChildren(
    buildLogo('ytb-blank-logo'),
    h('h2', { className: 'ytb-blank-title', text: 'Blocked by YouTubeMyTube' }),
    h('p', { className: 'ytb-blank-detail', text: reasonDetail(reason) }),
    buildActions(reason),
  );
}

export function showChannelOverlay(info: ChannelOverlayInfo): void {
  const host = document.body;
  if (!host) return;

  const key = `${reasonKey(info.reason)}|${info.name ?? ''}|${info.id ?? ''}`;
  if (overlay && currentKey === key && overlay.isConnected) return;
  clearChannelOverlay();

  document.addEventListener('play', pauseVideo, true);
  pauseAll();

  const root = buildOverlay(info);
  host.appendChild(root);
  overlay = root;
  currentKey = key;
}
