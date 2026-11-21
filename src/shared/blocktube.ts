import { isActiveEntry } from './patterns';
import { addChannel, addVideo } from './rules';
import type { AreaFlags, AreaKey, BlockerState } from './types';
import { CHANNEL_ID, normalizeHandle, splitChannelLabel, VIDEO_ID } from './url';

export type ImportedChannelRef = { name: string; handle: string };

const DEFAULT_JAVASCRIPT_MARKER = 'Custom conditions did not match, do not block';

const FILTER_LIST_KEYS = ['videoId', 'channelId', 'channelName', 'title', 'comment'] as const;

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
  channelRefs: ImportedChannelRef[];
  channelNameFilters: string[];
  titleFilters: string[];
  commentFilters: string[];
  areas: Partial<AreaFlags>;
  skipped: string[];
}

export interface BlockTubeMergeResult {
  state: BlockerState;
  added: number;
}

interface SanitizedList {
  entries: string[];
  rejected: number;
}

function sanitizeList(value: unknown, validate?: RegExp): SanitizedList {
  if (!Array.isArray(value)) return { entries: [], rejected: 0 };
  const seen = new Set<string>();
  const entries: string[] = [];
  let rejected = 0;
  for (const item of value) {
    if (typeof item !== 'string') {
      rejected += 1;
      continue;
    }
    const entry = item.trim();
    if (!isActiveEntry(entry)) continue;
    if (validate && !validate.test(entry)) {
      rejected += 1;
      continue;
    }
    if (seen.has(entry)) continue;
    seen.add(entry);
    entries.push(entry);
  }
  return { entries, rejected };
}

function isHandleEntry(entry: string): boolean {
  return entry.startsWith('@') && entry.length > 1;
}

// BlockTube matches channel names as text, so bare names stay pattern filters.
// A label carrying a handle keeps both halves on one channel row.
function splitChannelEntries(entries: string[]): {
  refs: ImportedChannelRef[];
  filters: string[];
} {
  const refs: ImportedChannelRef[] = [];
  const filters: string[] = [];
  for (const entry of entries) {
    if (isHandleEntry(entry)) {
      refs.push({ name: '', handle: normalizeHandle(entry) });
      continue;
    }
    const { name, handle } = splitChannelLabel(entry);
    if (handle) refs.push({ name, handle });
    else filters.push(name);
  }
  return { refs, filters };
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

export function parseBlockTubeBackup(value: unknown): BlockTubeImport | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const filters = record.filterData;
  const options = record.options;
  if (
    !filters ||
    typeof filters !== 'object' ||
    Array.isArray(filters) ||
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    return null;
  }

  const filterData = filters as Record<string, unknown>;
  const optionData = options as Record<string, unknown>;
  if (!FILTER_LIST_KEYS.some((key) => Array.isArray(filterData[key]))) return null;

  const areas: Partial<AreaFlags> = {};
  if (optionData.trending === true) areas.trendingPage = true;
  if (optionData.shorts === true) {
    areas.shortsPage = true;
    areas.shortsShelf = true;
  }

  const videoIds = sanitizeList(filterData.videoId, VIDEO_ID);
  const channelIds = sanitizeList(filterData.channelId, CHANNEL_ID);
  const channelNames = sanitizeList(filterData.channelName);

  const skipped = new Set<string>();
  if (videoIds.rejected > 0) skipped.add('invalid video IDs');
  if (channelIds.rejected > 0) skipped.add('invalid channel IDs');
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

  const { refs: channelRefs, filters: channelNameFilters } = splitChannelEntries(
    channelNames.entries,
  );

  return {
    videoIds: videoIds.entries,
    channelIds: channelIds.entries,
    channelRefs,
    channelNameFilters,
    titleFilters: sanitizeList(filterData.title).entries,
    commentFilters: sanitizeList(filterData.comment).entries,
    areas,
    skipped: [...skipped],
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
    if (addChannel(rules, { id: '', name: ref.name, handle: ref.handle })) added += 1;
  }

  const channelFilters = mergePatternList(rules.channelFilters, data.channelNameFilters);
  rules.channelFilters = channelFilters.list;
  added += channelFilters.added;

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
