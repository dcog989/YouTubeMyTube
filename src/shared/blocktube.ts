import { isActiveEntry } from './patterns';
import { addChannel, addVideo } from './rules';
import type { AreaFlags, AreaKey, BlockerState } from './types';

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
  channelHandles: string[];
  channelFilters: string[];
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

function splitChannelName(entries: string[]): { handles: string[]; filters: string[] } {
  const handles: string[] = [];
  const filters: string[] = [];
  for (const entry of entries) {
    if (isHandleEntry(entry)) handles.push(entry);
    else filters.push(entry);
  }
  return { handles, filters };
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

  const channelName = splitChannelName(sanitizeList(filterData.channelName));

  return {
    ok: true,
    data: {
      videoIds: sanitizeList(filterData.videoId),
      channelIds: sanitizeList(filterData.channelId),
      channelHandles: channelName.handles,
      channelFilters: channelName.filters,
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

  for (const handle of data.channelHandles) {
    if (addChannel(rules, { id: '', name: '', handle })) added += 1;
  }

  const channelFilters = mergePatternList(rules.channelFilters, data.channelFilters);
  rules.channelFilters = channelFilters.list;
  const titleFilters = mergePatternList(rules.titleFilters, data.titleFilters);
  rules.titleFilters = titleFilters.list;
  const commentFilters = mergePatternList(rules.commentFilters, data.commentFilters);
  rules.commentFilters = commentFilters.list;
  added += channelFilters.added + titleFilters.added + commentFilters.added;

  const areas: AreaFlags = { ...state.areas };
  for (const key of Object.keys(data.areas) as AreaKey[]) {
    if (data.areas[key]) areas[key] = true;
  }

  return { state: { ...state, rules, areas }, added };
}
