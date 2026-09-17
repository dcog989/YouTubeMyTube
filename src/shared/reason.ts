import { HANDLE_PREFIX } from './constants';

export type ReasonKind =
  | 'video'
  | 'channel'
  | 'handle'
  | 'area'
  | 'channelName'
  | 'title'
  | 'commentAuthor'
  | 'commentContent';

export interface Reason {
  kind: ReasonKind;
  value: string;
}

const COMMENT_CONTENT_REASON = 'comment content';

const REASON_PATTERNS: ReadonlyArray<readonly [ReasonKind, RegExp]> = [
  ['video', /^video id (.+)$/],
  ['channel', /^channel id (.+)$/],
  ['handle', /^channel handle (.+)$/],
  ['channelName', /^channel name "(.*)"$/],
  ['title', /^title "(.*)"$/],
  ['commentAuthor', /^comment author "(.*)"$/],
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
    case 'channelName':
      return `channel name "${value}"`;
    case 'title':
      return `title "${value}"`;
    case 'commentAuthor':
      return `comment author "${value}"`;
    case 'area':
      return `area ${value}`;
    case 'commentContent':
      return COMMENT_CONTENT_REASON;
  }
}

export function parseReason(raw: string): Reason | null {
  if (raw === COMMENT_CONTENT_REASON) return { kind: 'commentContent', value: '' };
  for (const [kind, pattern] of REASON_PATTERNS) {
    const match = pattern.exec(raw);
    if (match?.[1] !== undefined) return { kind, value: match[1] };
  }
  return null;
}
