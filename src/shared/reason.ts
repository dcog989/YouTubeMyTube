import { HANDLE_PREFIX, YOUTUBE_ORIGIN } from './constants';
import { normalizeHandle } from './url';

export interface Reason {
  kind: ReasonKind;
  value: string;
}

export type RuleRefKind = 'video' | 'channel' | 'handle';

export interface RuleRef {
  kind: RuleRefKind;
  value: string;
}

export interface ReasonSpec {
  // Values may contain newlines (titles, comments), so capture with `[\s\S]`.
  pattern: RegExp;
  format: (value: string) => string;
  ref?: (value: string) => RuleRef | null;
  url?: (value: string) => string;
}

const REASONS = {
  video: {
    pattern: /^video id ([\s\S]+)$/,
    format: (value) => `video id ${value}`,
    ref: (value) => ({ kind: 'video', value }),
    url: (value) => `${YOUTUBE_ORIGIN}/watch?v=${encodeURIComponent(value)}`,
  },
  channel: {
    pattern: /^channel id ([\s\S]+)$/,
    format: (value) => `channel id ${value}`,
    ref: (value) => ({ kind: 'channel', value }),
    url: (value) => `${YOUTUBE_ORIGIN}/channel/${encodeURIComponent(value)}`,
  },
  handle: {
    pattern: /^channel handle (.+)$/,
    format: (value) => `channel handle ${HANDLE_PREFIX}${value}`,
    ref: (value) => {
      const handle = normalizeHandle(value);
      return handle ? { kind: 'handle', value: handle } : null;
    },
    url: (value) => `${YOUTUBE_ORIGIN}/@${encodeURIComponent(normalizeHandle(value))}`,
  },
  title: {
    pattern: /^title filter "([\s\S]*)"$/,
    format: (value) => `title filter "${value}"`,
  },
  channelName: {
    pattern: /^channel filter "([\s\S]*)"$/,
    format: (value) => `channel filter "${value}"`,
  },
  comment: {
    pattern: /^comment filter "([\s\S]*)"$/,
    format: (value) => `comment filter "${value}"`,
  },
  area: {
    pattern: /^area ([\s\S]+)$/,
    format: (value) => `area ${value}`,
  },
} as const satisfies Record<string, ReasonSpec>;

export type ReasonKind = keyof typeof REASONS;

export function reasonSpec(kind: ReasonKind): ReasonSpec {
  return REASONS[kind];
}

export function formatReason(reason: Reason): string {
  return reasonSpec(reason.kind).format(reason.value);
}

export function parseReason(raw: string): Reason | null {
  for (const kind of Object.keys(REASONS) as ReasonKind[]) {
    const value = reasonSpec(kind).pattern.exec(raw)?.[1];
    if (value === undefined) continue;
    return { kind, value: kind === 'handle' ? value.replace(/^@/, '') : value };
  }
  return null;
}
