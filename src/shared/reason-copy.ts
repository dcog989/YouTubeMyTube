import type { Reason, ReasonKind } from './reason';
import { normalizeHandle } from './url';

const LABELS: Partial<Record<ReasonKind, string>> = {
  video: 'This video is blocked.',
  channel: 'This channel is blocked.',
  handle: 'This channel is blocked.',
  channelName: 'This channel is blocked.',
  area: 'This page is blocked.',
};

const DETAILS: Record<ReasonKind, (value: string) => string> = {
  video: (value) => `Blocked video ID: ${value}`,
  channel: (value) => `Blocked channel ID: ${value}`,
  handle: (value) => {
    const handle = normalizeHandle(value);
    return handle ? `Blocked channel: @${handle}` : 'Blocked channel.';
  },
  title: (value) => (value ? `Blocked title: ${value}` : 'Blocked by a title filter.'),
  channelName: (value) =>
    value ? `Blocked channel name: ${value}` : 'Blocked by a channel filter.',
  comment: (value) => (value ? `Blocked comment: ${value}` : 'Blocked by a comment filter.'),
  area: (value) => `Blocked page: ${value}`,
};

export function reasonLabel(reason: Reason | null, fallback: string): string {
  if (!reason) return fallback;
  return LABELS[reason.kind] ?? fallback;
}

export function reasonDetail(reason: Reason): string {
  return DETAILS[reason.kind](reason.value);
}
