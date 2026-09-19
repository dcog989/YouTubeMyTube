import { YOUTUBE_ORIGIN } from './constants';
import { normalizeHandle } from './matcher';
import { parseReason, type ReasonKind } from './reason';
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

export function ruleRefForReason(reason: string): RuleRef | null {
  const parsed = parseReason(reason);
  if (!parsed) return null;
  switch (parsed.kind) {
    case 'video':
      return { kind: 'video', value: parsed.value };
    case 'channel':
      return { kind: 'channel', value: parsed.value };
    case 'handle': {
      const value = normalizeHandle(parsed.value);
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

export function reasonLabel(reason: string, fallback: string): string {
  const parsed = parseReason(reason);
  return (parsed && REASON_LABELS[parsed.kind]) || fallback;
}

export function reasonDetail(reason: string): string {
  const parsed = parseReason(reason);
  if (!parsed) return reason;
  switch (parsed.kind) {
    case 'video':
      return `Blocked video ID: ${parsed.value}`;
    case 'channel':
      return `Blocked channel ID: ${parsed.value}`;
    case 'handle': {
      const value = normalizeHandle(parsed.value);
      return value ? `Blocked channel: @${value}` : reason;
    }
    case 'title':
      return parsed.value ? `Blocked title: ${parsed.value}` : reason;
    case 'channelName':
      return parsed.value ? `Blocked channel name: ${parsed.value}` : reason;
    case 'comment':
      return parsed.value ? `Blocked comment: ${parsed.value}` : reason;
    default:
      return reason;
  }
}

export function entityUrlForReason(reason: string): string | null {
  const parsed = parseReason(reason);
  if (!parsed) return null;
  switch (parsed.kind) {
    case 'video':
      return `${YOUTUBE_ORIGIN}/watch?v=${encodeURIComponent(parsed.value)}`;
    case 'channel':
      return `${YOUTUBE_ORIGIN}/channel/${encodeURIComponent(parsed.value)}`;
    case 'handle':
      return `${YOUTUBE_ORIGIN}/@${encodeURIComponent(parsed.value.replace(/^@/, ''))}`;
    default:
      return null;
  }
}
