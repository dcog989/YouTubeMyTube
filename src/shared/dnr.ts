import { AREA_DEFINITIONS } from './areas';
import { MAX_DNR_REGEX_RULES, YOUTUBE_HOME, YOUTUBE_HOST_PATTERN } from './constants';
import { escapeRegExp, isActiveEntry } from './matcher';
import { formatReason } from './reason';
import type { BlockerState } from './types';

export interface DnrBuild {
  rules: chrome.declarativeNetRequest.Rule[];
  dropped: number;
}

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
      isUrlFilterCaseSensitive: true,
      resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
    },
  };
}

function videoIdPattern(videoId: string): string {
  const id = escapeRegExp(videoId);
  return `${YOUTUBE_HOST_PATTERN}/(?:watch\\?(?:[^#]*&)?v=${id}(?:[&#]|$)|(?:shorts|embed|live)/${id}(?:[/?#]|$))`;
}

function channelIdPattern(channelId: string): string {
  return `${YOUTUBE_HOST_PATTERN}/channel/${escapeRegExp(channelId)}(?:[/?#]|$)`;
}

function caseInsensitiveLiteral(value: string): string {
  return escapeRegExp(value).replace(/[a-z]/gi, (letter) => {
    const lower = letter.toLowerCase();
    const upper = letter.toUpperCase();
    return lower === upper ? letter : `[${lower}${upper}]`;
  });
}

function handlePattern(handle: string): string {
  return `${YOUTUBE_HOST_PATTERN}/${caseInsensitiveLiteral(`@${handle}`)}(?:[/?#]|$)`;
}

function blockedPage(reason: string): chrome.declarativeNetRequest.Redirect {
  return { extensionPath: `/blocked.html?reason=${encodeURIComponent(reason)}` };
}

export function buildDnrRules(state: BlockerState): DnrBuild {
  if (!state.settings.enabled) return { rules: [], dropped: 0 };

  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let nextId = 1;
  let dropped = 0;

  const push = (regexFilter: string, target: chrome.declarativeNetRequest.Redirect): void => {
    if (rules.length >= MAX_DNR_REGEX_RULES) {
      dropped += 1;
      return;
    }
    rules.push(redirectRule(nextId, regexFilter, target));
    nextId += 1;
  };

  for (const area of AREA_DEFINITIONS) {
    if (area.redirect && area.path && state.areas[area.key]) {
      push(`${YOUTUBE_HOST_PATTERN}${area.path}(?:[/?#]|$)`, { url: YOUTUBE_HOME });
    }
  }

  for (const { id } of state.rules.videos) {
    const value = id.trim();
    if (!isActiveEntry(value)) continue;
    push(videoIdPattern(value), blockedPage(formatReason('video', value)));
  }

  for (const { id, handle } of state.rules.channels) {
    const channelId = id.trim();
    if (isActiveEntry(channelId)) {
      push(channelIdPattern(channelId), blockedPage(formatReason('channel', channelId)));
    }
    if (isActiveEntry(handle)) {
      push(handlePattern(handle), blockedPage(formatReason('handle', handle)));
    }
  }

  return { rules, dropped };
}
