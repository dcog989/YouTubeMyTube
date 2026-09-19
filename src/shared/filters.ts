export type PatternFilterKey = 'channelFilters' | 'titleFilters' | 'commentFilters';

export interface PatternFilterDefinition {
  key: PatternFilterKey;
  title: string;
  help: string;
  placeholder: string;
}

export const PATTERN_FILTERS: readonly PatternFilterDefinition[] = [
  {
    key: 'channelFilters',
    title: 'Channel name / handle filters',
    help: 'Keywords or /regex/flags, one per line. Matched against channel names and handles.',
    placeholder: 'Example Channel\n/\\bdrama\\b/i',
  },
  {
    key: 'titleFilters',
    title: 'Video title filters',
    help: 'Keywords or /regex/flags, one per line. Matched against card titles.',
    placeholder: 'clickbait\n/\\bspoilers?\\b/i',
  },
  {
    key: 'commentFilters',
    title: 'Comment filters',
    help: 'Keywords or /regex/flags, one per line. Matched against comment authors and text.',
    placeholder: 'spammer\n/free\\s+crypto/i',
  },
];
