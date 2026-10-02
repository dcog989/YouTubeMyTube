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

interface DnrPlanEntry {
  regexFilter: string;
  target: DnrRedirect;
  caseSensitive: boolean;
}

export interface DnrBuild {
  rules: DnrRule[];
  dropped: number;
}

function redirectRule(id: number, entry: DnrPlanEntry): DnrRule {
  return {
    id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: entry.target,
    },
    condition: {
      regexFilter: entry.regexFilter,
      isUrlFilterCaseSensitive: entry.caseSensitive,
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
  return `${YOUTUBE_HOST_PATTERN}/${escapeRegExp(`@${encodeURIComponent(handle)}`)}(?:[/?#]|$)`;
}

function blockedPage(reason: string): DnrRedirect {
  return { extensionPath: `/blocked.html?reason=${encodeURIComponent(reason)}` };
}

function planDnrRules(state: BlockerState): DnrPlanEntry[] {
  if (!state.settings.enabled) return [];

  const plan: DnrPlanEntry[] = [];

  for (const area of AREA_DEFINITIONS) {
    if (area.mode !== 'redirect' || !state.areas[area.key]) continue;
    plan.push({
      regexFilter: `${YOUTUBE_HOST_PATTERN}${area.path}(?:[/?#]|$)`,
      target: { url: YOUTUBE_HOME },
      caseSensitive: true,
    });
  }

  for (const { id } of state.rules.videos) {
    const value = id.trim();
    if (!isActiveEntry(value)) continue;
    plan.push({
      regexFilter: videoIdPattern(value),
      target: blockedPage(formatReason({ kind: 'video', value })),
      caseSensitive: true,
    });
  }

  for (const { id, handle } of state.rules.channels) {
    const channelId = id.trim();
    if (isActiveEntry(channelId)) {
      const reason = formatReason({ kind: 'channel', value: channelId });
      plan.push({
        regexFilter: channelIdPattern(channelId),
        target: blockedPage(reason),
        caseSensitive: true,
      });
    }
    if (isActiveEntry(handle)) {
      const reason = formatReason({ kind: 'handle', value: handle });
      plan.push({
        regexFilter: handlePattern(handle),
        target: blockedPage(reason),
        caseSensitive: false,
      });
    }
  }

  return plan;
}

export function buildDnrRules(state: BlockerState): DnrBuild {
  const plan = planDnrRules(state);
  const rules = plan
    .slice(0, MAX_DNR_REGEX_RULES)
    .map((entry, index) => redirectRule(index + 1, entry));
  return { rules, dropped: plan.length - rules.length };
}

export function countDnrRules(state: BlockerState): number {
  return planDnrRules(state).length;
}

export function getDynamicRules(): Promise<DnrRule[]> {
  return browser.declarativeNetRequest.getDynamicRules();
}

export function updateDynamicRules(options: DnrUpdateOptions): Promise<void> {
  return browser.declarativeNetRequest.updateDynamicRules(options);
}
