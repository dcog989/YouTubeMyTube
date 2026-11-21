import { AREA_DEFINITIONS } from './areas';
import {
  BLOCKED_PAGE,
  MAX_DNR_REGEX_RULES,
  MAX_DNR_RULES,
  YOUTUBE_HOME,
  YOUTUBE_HOST_PATTERN,
} from './constants';
import { escapeRegExp, isActiveEntry } from './patterns';
import { formatReason } from './reason';
import type { BlockerState } from './types';
import { CHANNEL_ID, HANDLE, VIDEO_ID } from './url';

export type DnrRule = browser.declarativeNetRequest.Rule;

const AREA_RULE_PRIORITY = 1;
const ENTITY_RULE_PRIORITY = 2;

interface DnrRedirect {
  extensionPath?: string;
  url?: string;
}

interface DnrPlanEntry {
  regexFilter?: string;
  urlFilter?: string;
  target: DnrRedirect;
  caseSensitive: boolean;
  priority: number;
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
    priority: entry.priority,
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

// `urlFilter` gives `*`, `|` and `^` their own meaning; entity fields must only
// contribute literal characters.
function urlFilterLiteral(value: string): string {
  return value.replace(/[*|^]/g, '');
}

function isDnrVideoId(value: string): boolean {
  const id = value.trim();
  return isActiveEntry(id) && VIDEO_ID.test(id);
}

function isDnrChannelId(value: string): boolean {
  const id = value.trim();
  return isActiveEntry(id) && CHANNEL_ID.test(id);
}

function isDnrHandle(value: string): boolean {
  const handle = value.trim();
  return isActiveEntry(handle) && HANDLE.test(handle);
}

function channelIdFilter(channelId: string): string {
  return `||youtube.com/channel/${urlFilterLiteral(channelId)}^`;
}

function handleFilter(handle: string): string {
  return `||youtube.com/@${encodeURIComponent(urlFilterLiteral(handle))}^`;
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
      priority: AREA_RULE_PRIORITY,
    });
  }

  for (const { id } of state.rules.videos) {
    const value = id.trim();
    if (!isDnrVideoId(value)) continue;
    plan.push({
      regexFilter: videoIdPattern(value),
      target: blockedPage(formatReason({ kind: 'video', value })),
      caseSensitive: true,
      priority: ENTITY_RULE_PRIORITY,
    });
  }

  for (const { id, handle } of state.rules.channels) {
    const channelId = id.trim();
    if (isDnrChannelId(channelId)) {
      const reason = formatReason({ kind: 'channel', value: channelId });
      plan.push({
        urlFilter: channelIdFilter(channelId),
        target: blockedPage(reason),
        caseSensitive: true,
        priority: ENTITY_RULE_PRIORITY,
      });
    }
    const channelHandle = handle.trim();
    if (isDnrHandle(channelHandle)) {
      const reason = formatReason({ kind: 'handle', value: channelHandle });
      plan.push({
        urlFilter: handleFilter(channelHandle),
        target: blockedPage(reason),
        caseSensitive: false,
        priority: ENTITY_RULE_PRIORITY,
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
    if (rules.length >= MAX_DNR_RULES) {
      dropped += 1;
      continue;
    }
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

// Same rule set as buildDnrRules, counted from the plan so the warning cannot
// drift from what the worker installs.
export interface DnrCounts {
  total: number;
  regex: number;
}

export function countDnrRules(state: BlockerState): DnrCounts {
  const plan = planDnrRules(state);
  let regex = 0;
  for (const entry of plan) {
    if (entry.regexFilter !== undefined) regex += 1;
  }
  return { total: plan.length, regex };
}

export interface DnrOverflow {
  dropped: number;
  limit: number;
}

export function dnrOverflow(state: BlockerState): DnrOverflow | null {
  const counts = countDnrRules(state);
  const totalDropped = Math.max(0, counts.total - MAX_DNR_RULES);
  const regexDropped = Math.max(0, counts.regex - MAX_DNR_REGEX_RULES);
  const dropped = Math.max(totalDropped, regexDropped);
  if (dropped === 0) return null;
  return {
    dropped,
    limit: regexDropped >= dropped ? MAX_DNR_REGEX_RULES : MAX_DNR_RULES,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

function ruleKey(rule: DnrRule): string {
  return JSON.stringify(canonicalize(rule));
}

export function sameRules(existing: DnrRule[], next: DnrRule[]): boolean {
  if (existing.length !== next.length) return false;
  const existingById = new Map(existing.map((rule) => [rule.id, rule]));
  return next.every((rule) => {
    const other = existingById.get(rule.id);
    return other !== undefined && ruleKey(rule) === ruleKey(other);
  });
}

export function getDynamicRules(): Promise<DnrRule[]> {
  return browser.declarativeNetRequest.getDynamicRules();
}

// `updateDynamicRules` is atomic: a single rejected rule aborts the whole
// batch. Retry rule-by-rule on failure so one bad rule cannot suppress every
// other block, and report the ids that the browser rejected.
export async function applyDnrRules(
  removeRuleIds: number[],
  addRules: DnrRule[],
): Promise<number[]> {
  try {
    await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
    return [];
  } catch (error) {
    console.warn('YouTubeMyTube: atomic DNR update failed; retrying rule-by-rule', error);
  }

  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });

  const failedRuleIds: number[] = [];
  for (const rule of addRules) {
    try {
      await browser.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
    } catch (error) {
      failedRuleIds.push(rule.id);
      console.error(`YouTubeMyTube: DNR rule ${rule.id} was rejected`, error);
    }
  }
  return failedRuleIds;
}
