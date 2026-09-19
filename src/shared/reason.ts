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
  label?: string;
  detail: (value: string) => string;
  ref?: (value: string) => RuleRef | null;
  url?: (value: string) => string;
}

const REASONS = {
  video: {
    pattern: /^video id ([\s\S]+)$/,
    format: (value) => `video id ${value}`,
    label: 'This video is blocked.',
    detail: (value) => `Blocked video ID: ${value}`,
    ref: (value) => ({ kind: 'video', value }),
    url: (value) => `${YOUTUBE_ORIGIN}/watch?v=${encodeURIComponent(value)}`,
  },
  channel: {
    pattern: /^channel id ([\s\S]+)$/,
    format: (value) => `channel id ${value}`,
    label: 'This channel is blocked.',
    detail: (value) => `Blocked channel ID: ${value}`,
    ref: (value) => ({ kind: 'channel', value }),
    url: (value) => `${YOUTUBE_ORIGIN}/channel/${encodeURIComponent(value)}`,
  },
  handle: {
    pattern: /^channel handle (.+)$/,
    format: (value) => `channel handle ${HANDLE_PREFIX}${value}`,
    label: 'This channel is blocked.',
    detail: (value) => {
      const handle = normalizeHandle(value);
      return handle ? `Blocked channel: @${handle}` : 'Blocked channel.';
    },
    ref: (value) => {
      const handle = normalizeHandle(value);
      return handle ? { kind: 'handle', value: handle } : null;
    },
    url: (value) => `${YOUTUBE_ORIGIN}/@${encodeURIComponent(normalizeHandle(value))}`,
  },
  title: {
    pattern: /^title filter "([\s\S]*)"$/,
    format: (value) => `title filter "${value}"`,
    detail: (value) => (value ? `Blocked title: ${value}` : 'Blocked by a title filter.'),
  },
  channelName: {
    pattern: /^channel filter "([\s\S]*)"$/,
    format: (value) => `channel filter "${value}"`,
    label: 'This channel is blocked.',
    detail: (value) => (value ? `Blocked channel name: ${value}` : 'Blocked by a channel filter.'),
  },
  comment: {
    pattern: /^comment filter "([\s\S]*)"$/,
    format: (value) => `comment filter "${value}"`,
    detail: (value) => (value ? `Blocked comment: ${value}` : 'Blocked by a comment filter.'),
  },
  area: {
    pattern: /^area ([\s\S]+)$/,
    format: (value) => `area ${value}`,
    label: 'This page is blocked.',
    detail: (value) => `Blocked page: ${value}`,
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

export function reasonLabel(reason: Reason | null, fallback: string): string {
  if (!reason) return fallback;
  return reasonSpec(reason.kind).label ?? fallback;
}

export function reasonDetail(reason: Reason): string {
  return reasonSpec(reason.kind).detail(reason.value);
}
