import { MAX_DNR_RULES, YOUTUBE_HOME } from './constants';
import { escapeRegExp, normalizeHandle } from './matcher';
import type { AreaFlags, BlockerState } from './types';

const HOST = String.raw`https?://(?:www|m)\.youtube\.com`;

const AREA_PATTERNS: Record<keyof AreaFlags, string | null> = {
  homePage: null,
  trendingPage: `${HOST}/feed/trending(?:[/?#]|$)`,
  explorePage: `${HOST}/feed/explore(?:[/?#]|$)`,
  subscriptionsPage: `${HOST}/feed/subscriptions(?:[/?#]|$)`,
  shortsPage: `${HOST}/shorts(?:[/?#]|$)`,
  shortsShelf: null,
  commentsSection: null,
  liveChat: null,
  relatedVideos: null,
};

function redirectRule(
  id: number,
  regexFilter: string,
  target: chrome.declarativeNetRequest.Redirect,
): chrome.declarativeNetRequest.Rule {
  return {
    id,
    priority: 1,
    action: {
      type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
      redirect: target,
    },
    condition: {
      regexFilter,
      resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
    },
  };
}

function videoIdPattern(videoId: string): string {
  const id = escapeRegExp(videoId);
  return `${HOST}/(?:watch\\?(?:[^#]*&)?v=${id}(?:[&#]|$)|(?:shorts|embed|live)/${id}(?:[/?#]|$))`;
}

function channelIdPattern(channelId: string): string {
  return `${HOST}/channel/${escapeRegExp(channelId)}(?:[/?#]|$)`;
}

function handlePattern(handle: string): string {
  return `${HOST}/@${escapeRegExp(normalizeHandle(handle))}(?:[/?#]|$)`;
}

export function buildDnrRules(state: BlockerState): chrome.declarativeNetRequest.Rule[] {
  if (!state.settings.enabled) return [];

  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let nextId = 1;

  const push = (regexFilter: string, target: chrome.declarativeNetRequest.Redirect): void => {
    if (rules.length >= MAX_DNR_RULES) return;
    rules.push(redirectRule(nextId, regexFilter, target));
    nextId += 1;
  };

  for (const key of Object.keys(AREA_PATTERNS) as (keyof AreaFlags)[]) {
    const pattern = AREA_PATTERNS[key];
    if (pattern && state.areas[key]) {
      push(pattern, { url: YOUTUBE_HOME });
    }
  }

  const blockedPage: chrome.declarativeNetRequest.Redirect = { extensionPath: '/blocked.html' };

  for (const videoId of state.rules.videoIds) {
    const value = videoId.trim();
    if (!value || value.startsWith('//')) continue;
    push(videoIdPattern(value), blockedPage);
  }

  for (const channelId of state.rules.channelIds) {
    const value = channelId.trim();
    if (!value || value.startsWith('//')) continue;
    push(channelIdPattern(value), blockedPage);
  }

  for (const handle of state.rules.handles) {
    const value = normalizeHandle(handle);
    if (!value || value.startsWith('//')) continue;
    push(handlePattern(value), blockedPage);
  }

  return rules;
}
