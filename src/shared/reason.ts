import { HANDLE_PREFIX } from './constants';
import { normalizeHandle } from './url';

export type ReasonKind =
  | 'video'
  | 'channel'
  | 'handle'
  | 'area'
  | 'title'
  | 'channelName'
  | 'comment';

export interface Reason {
  kind: ReasonKind;
  value: string;
}

// Values may contain newlines (titles, comments), so capture with `[\s\S]`.
const REASON_PATTERNS: ReadonlyArray<readonly [ReasonKind, RegExp]> = [
  ['video', /^video id ([\s\S]+)$/],
  ['channel', /^channel id ([\s\S]+)$/],
  ['handle', /^channel handle (.+)$/],
  ['channelName', /^channel filter "([\s\S]*)"$/],
  ['title', /^title filter "([\s\S]*)"$/],
  ['comment', /^comment filter "([\s\S]*)"$/],
  ['area', /^area ([\s\S]+)$/],
];

export function formatReason(reason: Reason): string {
  const { kind, value } = reason;
  switch (kind) {
    case 'video':
      return `video id ${value}`;
    case 'channel':
      return `channel id ${value}`;
    case 'handle':
      return `channel handle ${HANDLE_PREFIX}${value}`;
    case 'title':
      return `title filter "${value}"`;
    case 'channelName':
      return `channel filter "${value}"`;
    case 'comment':
      return `comment filter "${value}"`;
    case 'area':
      return `area ${value}`;
  }
}

export function parseReason(raw: string): Reason | null {
  for (const [kind, pattern] of REASON_PATTERNS) {
    const value = pattern.exec(raw)?.[1];
    if (value === undefined) continue;
    return { kind, value: kind === 'handle' ? value.replace(/^@/, '') : value };
  }
  return null;
}

const REASON_LABELS: Partial<Record<ReasonKind, string>> = {
  video: 'This video is blocked.',
  channel: 'This channel is blocked.',
  handle: 'This channel is blocked.',
  channelName: 'This channel is blocked.',
  area: 'This page is blocked.',
};

export function reasonLabel(reason: Reason | null, fallback: string): string {
  return reason ? (REASON_LABELS[reason.kind] ?? fallback) : fallback;
}

export function reasonDetail(reason: Reason): string {
  switch (reason.kind) {
    case 'video':
      return `Blocked video ID: ${reason.value}`;
    case 'channel':
      return `Blocked channel ID: ${reason.value}`;
    case 'handle': {
      const value = normalizeHandle(reason.value);
      return value ? `Blocked channel: @${value}` : 'Blocked channel.';
    }
    case 'title':
      return reason.value ? `Blocked title: ${reason.value}` : 'Blocked by a title filter.';
    case 'channelName':
      return reason.value
        ? `Blocked channel name: ${reason.value}`
        : 'Blocked by a channel filter.';
    case 'comment':
      return reason.value ? `Blocked comment: ${reason.value}` : 'Blocked by a comment filter.';
    case 'area':
      return `Blocked page: ${reason.value}`;
  }
}
