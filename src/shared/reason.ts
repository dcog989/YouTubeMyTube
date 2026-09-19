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

const REASON_PATTERNS: ReadonlyArray<readonly [ReasonKind, RegExp]> = [
  ['video', /^video id (.+)$/],
  ['channel', /^channel id (.+)$/],
  ['handle', /^channel handle (.+)$/],
  ['channelName', /^channel filter "(.*)"$/],
  ['title', /^title filter "(.*)"$/],
  ['comment', /^comment filter "(.*)"$/],
  ['area', /^area (.+)$/],
];

export function formatReason(kind: ReasonKind, value = ''): string {
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
    const match = pattern.exec(raw);
    if (match?.[1] !== undefined) return { kind, value: match[1] };
  }
  return null;
}
