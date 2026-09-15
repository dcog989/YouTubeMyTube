import type { AreaFlags, AreaKey, BlockerState, FilterRules } from './types';

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
  rules: Pick<
    FilterRules,
    'videoIds' | 'channelIds' | 'channelNames' | 'titles' | 'commentAuthors' | 'commentContents'
  >;
  areas: Partial<AreaFlags>;
  blockMessage: string | null;
  skipped: string[];
  total: number;
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
    if (!entry || entry.startsWith('//')) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
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

  const channelNames = sanitizeList(filterData.channelName);
  const rules: BlockTubeImport['rules'] = {
    videoIds: sanitizeList(filterData.videoId),
    channelIds: sanitizeList(filterData.channelId),
    channelNames,
    titles: sanitizeList(filterData.title),
    // BlockTube matches channel-name filters against comment authors as well.
    commentAuthors: [...channelNames],
    commentContents: sanitizeList(filterData.comment),
  };

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

  const blockMessage =
    typeof optionData.block_message === 'string' && optionData.block_message.trim().length > 0
      ? optionData.block_message.trim()
      : null;

  const total = Object.values(rules).reduce((sum, list) => sum + list.length, 0);

  return {
    ok: true,
    data: { rules, areas, blockMessage, skipped: [...skipped], total },
  };
}

export function mergeBlockTubeImport(
  state: BlockerState,
  data: BlockTubeImport,
): BlockTubeMergeResult {
  const rules: FilterRules = { ...state.rules };
  let added = 0;

  for (const key of Object.keys(data.rules) as (keyof BlockTubeImport['rules'])[]) {
    const existing = new Set(rules[key]);
    const merged = [...rules[key]];
    for (const entry of data.rules[key]) {
      if (existing.has(entry)) continue;
      existing.add(entry);
      merged.push(entry);
      added += 1;
    }
    rules[key] = merged;
  }

  const areas: AreaFlags = { ...state.areas };
  for (const key of Object.keys(data.areas) as AreaKey[]) {
    if (data.areas[key]) areas[key] = true;
  }

  const settings = { ...state.settings };
  if (data.blockMessage) settings.blockMessage = data.blockMessage;

  return { state: { ...state, rules, areas, settings }, added };
}
