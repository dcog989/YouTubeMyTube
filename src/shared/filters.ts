import type { ReasonKind } from './reason';
import type { Entity, FilterRules } from './types';

export type FilterMatch = 'exact' | 'handle' | 'pattern';

export interface FilterDefinition {
  key: keyof FilterRules;
  match: FilterMatch;
  entityField: keyof Entity;
  reason: ReasonKind;
  title: string;
  help: string;
  placeholder: string;
}

const FILTER_META: Record<keyof FilterRules, Omit<FilterDefinition, 'key'>> = {
  videoIds: {
    match: 'exact',
    entityField: 'videoId',
    reason: 'video',
    title: 'Video IDs',
    help: 'Exact 11-character IDs, one per line. Blocks direct access and hides matching cards.',
    placeholder: 'dQw4w9WgXcQ',
  },
  titles: {
    match: 'pattern',
    entityField: 'title',
    reason: 'title',
    title: 'Video titles',
    help: 'Keywords or /regex/flags patterns, one per line. Matched against card titles.',
    placeholder: 'clickbait\n/\\bspoilers?\\b/i',
  },
  channelIds: {
    match: 'exact',
    entityField: 'channelId',
    reason: 'channel',
    title: 'Channel IDs',
    help: 'Exact channel IDs starting with UC, one per line.',
    placeholder: 'UCxxxxxxxxxxxxxxxxxxxxxx',
  },
  handles: {
    match: 'handle',
    entityField: 'handle',
    reason: 'handle',
    title: 'Channel handles',
    help: 'Handle names without the @, one per line.',
    placeholder: 'somechannel',
  },
  channelNames: {
    match: 'pattern',
    entityField: 'channelName',
    reason: 'channelName',
    title: 'Channel names',
    help: 'Keywords or /regex/flags patterns, one per line. Matched against channel text.',
    placeholder: 'Example Channel\n/\\bdrama\\b/i',
  },
  commentAuthors: {
    match: 'pattern',
    entityField: 'commentAuthor',
    reason: 'commentAuthor',
    title: 'Comment authors',
    help: 'Keywords, channel IDs, handles, or /regex/flags patterns for comment authors.',
    placeholder: 'spammer',
  },
  commentContents: {
    match: 'pattern',
    entityField: 'commentContent',
    reason: 'commentContent',
    title: 'Comment content',
    help: 'Keywords or /regex/flags patterns, one per line. Matched against comment text.',
    placeholder: '/free\\s+crypto/i',
  },
};

export const FILTER_DEFINITIONS: readonly FilterDefinition[] = (
  Object.keys(FILTER_META) as (keyof FilterRules)[]
).map((key) => ({ key, ...FILTER_META[key] }));
