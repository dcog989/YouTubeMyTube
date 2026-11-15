import { isActiveEntry } from './patterns';
import { addChannel, addVideo } from './rules';
import type { AreaFlags, AreaKey, BlockerState } from './types';
import { normalizeHandle, splitChannelLabel } from './url';

export type ChannelRef = { name: string; handle: string };

const DEFAULT_JAVASCRIPT_MARKER = 'Custom conditions did not match, do not block';

const UNSUPPORTED_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['autoplay', 'autoplay blocking'],
  ['mixes', 'mix blocking'],
  ['movies', 'movie blocking'],
  ['suggestions_only', 'suggestions-only mode'],
  ['disable_db_normalize', 'title normalization'],
  ['disable_on_history', 'history-based hiding'],
  ['disable_you_there', '“You there?” dialog removal'],
  ['block_feedback', 'block feedback'],
];

export interface BlockTubeImport {
  videoIds: string[];
  channelIds: string[];
  channelRefs: ChannelRef[];
  titleFilters: string[];
  commentFilters: string[];
  areas: Partial<AreaFlags>;
  skipped: string[];
}

export type BlockTubeParseResult =
  | { ok: true; data: BlockTubeImport }
  | { ok: false; error: string };

export interface BlockTubeMergeResult {
  state: BlockerState;
  added: number;
}

function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const entry = item.trim();
    if (!isActiveEntry(entry)) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

function isHandleEntry(entry: string): boolean {
  return entry.startsWith('@') && entry.length > 1;
}

// BlockTube matches channel names exactly, so names become name-only rows
// instead of substring filters that would hide every channel containing them.
// A label that carries a trailing handle keeps both halves on one row.
function splitChannelEntries(entries: string[]): ChannelRef[] {
  return entries.map((entry) =>
    isHandleEntry(entry) ? { name: '', handle: normalizeHandle(entry) } : splitChannelLabel(entry),
  );
}

function hasAdvancedJavaScript(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.includes(DEFAULT_JAVASCRIPT_MARKER);
}

function hasVideoLengthFilter(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((entry) => typeof entry === 'number' && Number.isFinite(entry))
  );
}

export function parseBlockTubeBackup(value: unknown): BlockTubeParseResult {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'That file is not a BlockTube backup.' };
  }

  const record = value as Record<string, unknown>;
  const filters = record.filterData;
  const options = record.options;
  if (!filters || typeof filters !== 'object' || !options || typeof options !== 'object') {
    return {
      ok: false,
      error: 'That file is not a BlockTube backup (missing filterData/options).',
    };
  }

  const filterData = filters as Record<string, unknown>;
  const optionData = options as Record<string, unknown>;

  const areas: Partial<AreaFlags> = {};
  if (optionData.trending === true) areas.trendingPage = true;
  if (optionData.shorts === true) {
    areas.shortsPage = true;
    areas.shortsShelf = true;
  }

  const skipped = new Set<string>();
  if (hasAdvancedJavaScript(filterData.javascript) || optionData.enable_javascript === true) {
    skipped.add('advanced JavaScript blocking');
  }
  if (hasVideoLengthFilter(filterData.vidLength)) skipped.add('video length filters');
  for (const [key, label] of UNSUPPORTED_OPTIONS) {
    if (optionData[key] === true) skipped.add(label);
  }
  if (
    typeof optionData.percent_watched_hide === 'number' &&
    Number.isFinite(optionData.percent_watched_hide)
  ) {
    skipped.add('watched-percentage hiding');
  }
  if (typeof record.uiPass === 'string' && record.uiPass !== '') {
    skipped.add('options password');
  }
  if (typeof optionData.block_message === 'string' && optionData.block_message.trim().length > 0) {
    skipped.add('block message');
  }

  const channelRefs = splitChannelEntries(sanitizeList(filterData.channelName));

  return {
    ok: true,
    data: {
      videoIds: sanitizeList(filterData.videoId),
      channelIds: sanitizeList(filterData.channelId),
      channelRefs,
      titleFilters: sanitizeList(filterData.title),
      commentFilters: sanitizeList(filterData.comment),
      areas,
      skipped: [...skipped],
    },
  };
}

function mergePatternList(
  existing: string[],
  incoming: string[],
): { list: string[]; added: number } {
  const seen = new Set(existing);
  const list = [...existing];
  let added = 0;
  for (const entry of incoming) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    list.push(entry);
    added += 1;
  }
  return { list, added };
}

export function mergeBlockTubeImport(
  state: BlockerState,
  data: BlockTubeImport,
): BlockTubeMergeResult {
  const rules = structuredClone(state.rules);
  let added = 0;

  for (const id of data.videoIds) {
    if (addVideo(rules, { id, title: '' })) added += 1;
  }

  for (const id of data.channelIds) {
    if (addChannel(rules, { id, name: '', handle: '' })) added += 1;
  }

  for (const ref of data.channelRefs) {
    if (addChannel(rules, { id: '', name: ref.name, handle: ref.handle ?? '' })) added += 1;
  }

  const titles = mergePatternList(rules.titleFilters, data.titleFilters);
  rules.titleFilters = titles.list;
  added += titles.added;

  const comments = mergePatternList(rules.commentFilters, data.commentFilters);
  rules.commentFilters = comments.list;
  added += comments.added;

  const areas: AreaFlags = { ...state.areas };
  for (const key of Object.keys(data.areas) as AreaKey[]) {
    if (data.areas[key]) areas[key] = true;
  }

  return { state: { ...state, rules, areas }, added };
}
