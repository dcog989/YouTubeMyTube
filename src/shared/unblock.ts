import { YOUTUBE_ORIGIN } from './constants';
import { normalizeHandle } from './matcher';
import type { Reason, ReasonKind } from './reason';
import { removeChannel, removeVideo } from './rules';
import type { FilterRules } from './types';

export type RuleRefKind = 'video' | 'channel' | 'handle';

export interface RuleRef {
  kind: RuleRefKind;
  value: string;
}

const REASON_LABELS: Partial<Record<ReasonKind, string>> = {
  video: 'This video is blocked.',
  channel: 'This channel is blocked.',
  handle: 'This channel is blocked.',
  channelName: 'This channel is blocked.',
  area: 'This page is blocked.',
};

export function ruleRefForReason(reason: Reason | null): RuleRef | null {
  if (!reason) return null;
  switch (reason.kind) {
    case 'video':
      return { kind: 'video', value: reason.value };
    case 'channel':
      return { kind: 'channel', value: reason.value };
    case 'handle': {
      const value = normalizeHandle(reason.value);
      return value ? { kind: 'handle', value } : null;
    }
    default:
      return null;
  }
}

export function removeRule(rules: FilterRules, ref: RuleRef): boolean {
  if (ref.kind === 'video') return removeVideo(rules, ref.value);
  if (ref.kind === 'channel') return removeChannel(rules, { id: ref.value });
  return removeChannel(rules, { handle: ref.value });
}

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

export function entityUrlForReason(reason: Reason | null): string | null {
  if (!reason) return null;
  switch (reason.kind) {
    case 'video':
      return `${YOUTUBE_ORIGIN}/watch?v=${encodeURIComponent(reason.value)}`;
    case 'channel':
      return `${YOUTUBE_ORIGIN}/channel/${encodeURIComponent(reason.value)}`;
    case 'handle':
      return `${YOUTUBE_ORIGIN}/@${encodeURIComponent(normalizeHandle(reason.value))}`;
    default:
      return null;
  }
}
