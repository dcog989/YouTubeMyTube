import { normalizeHandle } from './matcher';
import type { FilterRules } from './types';

const YOUTUBE_ORIGIN = 'https://www.youtube.com';

export interface RuleRef {
  key: keyof FilterRules;
  value: string;
}

const VIDEO_ID_PREFIX = 'video id ';
const CHANNEL_ID_PREFIX = 'channel id ';
const CHANNEL_HANDLE_PREFIX = 'channel handle ';

const REASON_LABELS: Record<string, string> = {
  video: 'This video is blocked.',
  channel: 'This channel is blocked.',
  handle: 'This channel is blocked.',
  area: 'This page is blocked.',
};

export function ruleRefForReason(reason: string): RuleRef | null {
  if (reason.startsWith(VIDEO_ID_PREFIX)) {
    return { key: 'videoIds', value: reason.slice(VIDEO_ID_PREFIX.length) };
  }
  if (reason.startsWith(CHANNEL_ID_PREFIX)) {
    return { key: 'channelIds', value: reason.slice(CHANNEL_ID_PREFIX.length) };
  }
  if (reason.startsWith(CHANNEL_HANDLE_PREFIX)) {
    const value = normalizeHandle(reason.slice(CHANNEL_HANDLE_PREFIX.length));
    return value ? { key: 'handles', value } : null;
  }
  const name = /^channel name "(.*)"$/.exec(reason);
  if (name?.[1]) return { key: 'channelNames', value: name[1] };
  return null;
}

export function removeRule(rules: FilterRules, ref: RuleRef): boolean {
  const list = rules[ref.key];
  const index =
    ref.key === 'handles'
      ? list.findIndex((entry) => normalizeHandle(entry) === ref.value)
      : list.indexOf(ref.value);
  if (index === -1) return false;
  list.splice(index, 1);
  return true;
}

export function reasonLabel(reason: string, fallback: string): string {
  const key = reason.split(' ')[0] ?? '';
  return REASON_LABELS[key] ?? fallback;
}

export function reasonDetail(reason: string): string {
  const video = /^video id (.+)$/.exec(reason);
  if (video?.[1]) return `Blocked video ID: ${video[1]}`;

  const channel = /^channel id (.+)$/.exec(reason);
  if (channel?.[1]) return `Blocked channel ID: ${channel[1]}`;

  const handle = /^channel handle (.+)$/.exec(reason);
  if (handle?.[1]) return `Blocked channel: ${handle[1]}`;

  const title = /^title "(.*)"$/.exec(reason);
  if (title?.[1]) return `Blocked title: ${title[1]}`;

  const name = /^channel name "(.*)"$/.exec(reason);
  if (name?.[1]) return `Blocked channel name: ${name[1]}`;

  return reason;
}

export function entityUrlForReason(reason: string): string | null {
  const video = /^video id (.+)$/.exec(reason);
  if (video?.[1]) return `${YOUTUBE_ORIGIN}/watch?v=${encodeURIComponent(video[1])}`;

  const channel = /^channel id (.+)$/.exec(reason);
  if (channel?.[1]) return `${YOUTUBE_ORIGIN}/channel/${encodeURIComponent(channel[1])}`;

  const handle = /^channel handle @?(.+)$/.exec(reason);
  if (handle?.[1]) return `${YOUTUBE_ORIGIN}/@${encodeURIComponent(handle[1])}`;

  return null;
}
