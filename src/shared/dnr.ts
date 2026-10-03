import { AREA_DEFINITIONS } from './areas';
import { BLOCKED_PAGE, MAX_DNR_REGEX_RULES, YOUTUBE_HOME, YOUTUBE_HOST_PATTERN } from './constants';
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
  regexFilter?: string;
  urlFilter?: string;
  target: DnrRedirect;
  caseSensitive: boolean;
}

export interface DnrBuild {
  rules: DnrRule[];
  dropped: number;
}

function redirectRule(id: number, entry: DnrPlanEntry): DnrRule {
  const condition: browser.declarativeNetRequest._RuleCondition = {
    isUrlFilterCaseSensitive: entry.caseSensitive,
    resourceTypes: ['main_frame'],
  };
  if (entry.regexFilter !== undefined) condition.regexFilter = entry.regexFilter;
  if (entry.urlFilter !== undefined) condition.urlFilter = entry.urlFilter;
  return {
    id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: entry.target,
    },
    condition,
  };
}

function videoIdPattern(videoId: string): string {
  const id = escapeRegExp(videoId);
  return `${YOUTUBE_HOST_PATTERN}/(?:watch\\?(?:[^#]*&)?v=${id}(?:[&#]|$)|(?:shorts|embed|live)/${id}(?:[/?#]|$))`;
}

function channelIdFilter(channelId: string): string {
  return `||youtube.com/channel/${channelId}^`;
}

function handleFilter(handle: string): string {
  return `||youtube.com/@${encodeURIComponent(handle)}^`;
}

function blockedPage(reason: string): DnrRedirect {
  return { extensionPath: `/${BLOCKED_PAGE}?reason=${encodeURIComponent(reason)}` };
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
        urlFilter: channelIdFilter(channelId),
        target: blockedPage(reason),
        caseSensitive: true,
      });
    }
    if (isActiveEntry(handle)) {
      const reason = formatReason({ kind: 'handle', value: handle });
      plan.push({
        urlFilter: handleFilter(handle),
        target: blockedPage(reason),
        caseSensitive: false,
      });
    }
  }

  return plan;
}

export function buildDnrRules(state: BlockerState): DnrBuild {
  const rules: DnrRule[] = [];
  let regexCount = 0;
  let dropped = 0;
  for (const entry of planDnrRules(state)) {
    if (entry.regexFilter !== undefined) {
      if (regexCount >= MAX_DNR_REGEX_RULES) {
        dropped += 1;
        continue;
      }
      regexCount += 1;
    }
    rules.push(redirectRule(rules.length + 1, entry));
  }
  return { rules, dropped };
}

export function countDnrRules(state: BlockerState): number {
  return planDnrRules(state).length;
}

export function countRegexDnrRules(state: BlockerState): number {
  return planDnrRules(state).filter((entry) => entry.regexFilter !== undefined).length;
}

export function getDynamicRules(): Promise<DnrRule[]> {
  return browser.declarativeNetRequest.getDynamicRules();
}

export function updateDynamicRules(options: DnrUpdateOptions): Promise<void> {
  return browser.declarativeNetRequest.updateDynamicRules(options);
}

// `updateDynamicRules` is atomic: a single rejected rule aborts the whole
// batch. Retry rule-by-rule on failure so one bad rule cannot suppress every
// other block, and report the ids that the browser rejected.
export async function applyDnrRules(
  removeRuleIds: number[],
  addRules: DnrRule[],
): Promise<number[]> {
  try {
    await updateDynamicRules({ removeRuleIds, addRules });
    return [];
  } catch (error) {
    console.warn('YouTubeMyTube: atomic DNR update failed; retrying rule-by-rule', error);
  }

  await updateDynamicRules({ removeRuleIds, addRules: [] });

  const failedRuleIds: number[] = [];
  for (const rule of addRules) {
    try {
      await updateDynamicRules({ addRules: [rule] });
    } catch (error) {
      failedRuleIds.push(rule.id);
      console.error(`YouTubeMyTube: DNR rule ${rule.id} was rejected`, error);
    }
  }
  return failedRuleIds;
}
