import { AREA_DEFINITIONS } from './areas';
import { MAX_DNR_REGEX_RULES, YOUTUBE_HOME, YOUTUBE_HOST_PATTERN } from './constants';
import { escapeRegExp, isActiveEntry } from './patterns';
import { formatReason } from './reason';
import type { BlockerState } from './types';

export type DnrRule = browser.declarativeNetRequest.Rule;

type DnrUpdateOptions = browser.declarativeNetRequest._UpdateDynamicRulesOptions;

interface DnrRedirect {
  extensionPath?: string;
  url?: string;
}

export interface DnrBuild {
  rules: DnrRule[];
  dropped: number;
}

function redirectRule(
  id: number,
  regexFilter: string,
  target: DnrRedirect,
  caseSensitive: boolean,
): DnrRule {
  return {
    id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: target,
    },
    condition: {
      regexFilter,
      isUrlFilterCaseSensitive: caseSensitive,
      resourceTypes: ['main_frame'],
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

function handlePattern(handle: string): string {
  return `${YOUTUBE_HOST_PATTERN}/${escapeRegExp(`@${handle}`)}(?:[/?#]|$)`;
}

function blockedPage(reason: string): DnrRedirect {
  return { extensionPath: `/blocked.html?reason=${encodeURIComponent(reason)}` };
}

export function buildDnrRules(state: BlockerState): DnrBuild {
  if (!state.settings.enabled) return { rules: [], dropped: 0 };

  const rules: DnrRule[] = [];
  let nextId = 1;
  let dropped = 0;

  const push = (regexFilter: string, target: DnrRedirect, caseSensitive = true): void => {
    if (rules.length >= MAX_DNR_REGEX_RULES) {
      dropped += 1;
      return;
    }
    rules.push(redirectRule(nextId, regexFilter, target, caseSensitive));
    nextId += 1;
  };

  for (const area of AREA_DEFINITIONS) {
    if (area.mode !== 'redirect' || !state.areas[area.key]) continue;
    push(`${YOUTUBE_HOST_PATTERN}${area.path}(?:[/?#]|$)`, { url: YOUTUBE_HOME });
  }

  for (const { id } of state.rules.videos) {
    const value = id.trim();
    if (!isActiveEntry(value)) continue;
    push(videoIdPattern(value), blockedPage(formatReason({ kind: 'video', value })));
  }

  for (const { id, handle } of state.rules.channels) {
    const channelId = id.trim();
    if (isActiveEntry(channelId)) {
      const reason = formatReason({ kind: 'channel', value: channelId });
      push(channelIdPattern(channelId), blockedPage(reason));
    }
    if (isActiveEntry(handle)) {
      const reason = formatReason({ kind: 'handle', value: handle });
      push(handlePattern(handle), blockedPage(reason), false);
    }
  }

  return { rules, dropped };
}

export function countDnrRules(state: BlockerState): number {
  if (!state.settings.enabled) return 0;
  let count = 0;
  for (const area of AREA_DEFINITIONS) {
    if (area.mode === 'redirect' && state.areas[area.key]) count += 1;
  }
  for (const { id } of state.rules.videos) {
    if (isActiveEntry(id)) count += 1;
  }
  for (const { id, handle } of state.rules.channels) {
    if (isActiveEntry(id)) count += 1;
    if (isActiveEntry(handle)) count += 1;
  }
  return count;
}

export function getDynamicRules(): Promise<DnrRule[]> {
  return browser.declarativeNetRequest.getDynamicRules();
}

export function updateDynamicRules(options: DnrUpdateOptions): Promise<void> {
  return browser.declarativeNetRequest.updateDynamicRules(options);
}
