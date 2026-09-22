import { t } from './i18n';
import type { Reason, ReasonKind } from './reason';
import { normalizeHandle } from './url';

const LABELS: Partial<Record<ReasonKind, string>> = {
  video: 'reasonVideoBlocked',
  channel: 'reasonChannelBlocked',
  handle: 'reasonChannelBlocked',
  channelName: 'reasonChannelBlocked',
  area: 'reasonAreaBlocked',
};

type Detail = { key: string; substitute: (value: string) => string | undefined };

const DETAILS: Record<ReasonKind, Detail> = {
  video: { key: 'reasonDetailVideoId', substitute: (value) => value },
  channel: { key: 'reasonDetailChannelId', substitute: (value) => value },
  handle: { key: 'reasonDetailHandle', substitute: (value) => normalizeHandle(value) || undefined },
  title: { key: 'reasonDetailTitle', substitute: (value) => value },
  channelName: {
    key: 'reasonDetailChannelName',
    substitute: (value) => value,
  },
  comment: { key: 'reasonDetailComment', substitute: (value) => value },
  area: { key: 'reasonDetailArea', substitute: (value) => value },
};

const EMPTY_DETAILS: Partial<Record<ReasonKind, string>> = {
  handle: 'reasonDetailHandleEmpty',
  title: 'reasonDetailTitleEmpty',
  channelName: 'reasonDetailChannelNameEmpty',
  comment: 'reasonDetailCommentEmpty',
};

export function reasonLabel(reason: Reason | null, fallback: string): string {
  if (!reason) return fallback;
  const key = LABELS[reason.kind];
  return key ? t(key) : fallback;
}

export function reasonDetail(reason: Reason): string {
  const detail = DETAILS[reason.kind];
  const substituted = detail.substitute(reason.value);
  if (substituted) return t(detail.key, substituted);
  const empty = EMPTY_DETAILS[reason.kind];
  return empty ? t(empty) : t(detail.key);
}
