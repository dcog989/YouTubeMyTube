import { YOUTUBE_ORIGIN } from './constants';
import type { Reason } from './reason';
import { normalizeHandle } from './url';

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
