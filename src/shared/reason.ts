import { HANDLE_PREFIX } from './constants';

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
