import { BLOCKED_PAGE, YOUTUBE_HOME } from '../shared/constants';
import { getRuntimeUrl } from '../shared/ext';
import { matchAreaRedirect, matchEntity, parseYouTubeUrl } from '../shared/matcher';
import { parseReason } from '../shared/reason';
import type { ParsedUrl } from '../shared/types';
import { currentContext } from './entity';
import { clearChannelOverlay, clearFeedback, setPlayerBlank, showChannelOverlay } from './overlay';
import { getCompiled, getState } from './store';

const EVALUATE_THROTTLE_MS = 150;

let lastEvaluate = 0;
let evaluatePending = false;

function redirectFor(reason: string): void {
  if (parseReason(reason)?.kind === 'area') {
    window.location.replace(YOUTUBE_HOME);
    return;
  }
  const url = new URL(getRuntimeUrl(BLOCKED_PAGE));
  url.searchParams.set('reason', reason);
  window.location.replace(url.toString());
}

function isSupportedPage(parsed: ParsedUrl, path: string): boolean {
  if (path === '/watch') return true;
  if (path.startsWith('/shorts/')) return true;
  return (
    parsed.kind === 'channel' ||
    parsed.kind === 'handle' ||
    parsed.kind === 'video' ||
    parsed.kind === 'shorts' ||
    parsed.kind === 'live' ||
    parsed.kind === 'embed'
  );
}

function evaluateBlocking(): void {
  const state = getState();
  const compiled = getCompiled();
  if (!state || !compiled) return;
  if (window.top !== window) return;

  if (!state.settings.enabled) {
    clearFeedback();
    return;
  }

  const path = window.location.pathname;
  const parsed = parseYouTubeUrl(window.location.href);

  const area = matchAreaRedirect(path, state.areas);
  if (area.blocked && area.reason) {
    redirectFor(area.reason);
    return;
  }

  if (!isSupportedPage(parsed, path)) {
    clearFeedback();
    return;
  }

  const entity = currentContext();
  const result = matchEntity(entity, compiled);
  if (result.blocked && result.reason) {
    const kind = parseReason(result.reason)?.kind;
    if (kind === 'video' || kind === 'title' || kind === 'comment') {
      clearChannelOverlay();
      setPlayerBlank(true, result.reason);
      return;
    }
    setPlayerBlank(false);
    showChannelOverlay({
      reason: result.reason,
      name: entity.channelName,
      id: entity.channelId ?? (entity.handle ? `@${entity.handle}` : undefined),
    });
    return;
  }

  clearFeedback();
}

export function scheduleEvaluate(): void {
  if (evaluatePending) return;
  const elapsed = performance.now() - lastEvaluate;
  if (elapsed >= EVALUATE_THROTTLE_MS) {
    lastEvaluate = performance.now();
    evaluateBlocking();
    return;
  }
  evaluatePending = true;
  setTimeout(() => {
    evaluatePending = false;
    lastEvaluate = performance.now();
    evaluateBlocking();
  }, EVALUATE_THROTTLE_MS - elapsed);
}
