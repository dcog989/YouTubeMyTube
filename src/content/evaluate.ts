import { BLOCKED_PAGE, YOUTUBE_HOME } from '../shared/constants';
import { getRuntimeUrl } from '../shared/ext';
import { matchAreaRedirect, matchEntity, parseYouTubeUrl } from '../shared/matcher';
import { formatReason, type Reason } from '../shared/reason';
import type { ParsedUrl } from '../shared/types';
import { currentContext } from './entity';
import { clearChannelOverlay, clearFeedback, setPlayerBlank, showChannelOverlay } from './overlay';
import { getSnapshot } from './store';

const HYDRATION_EVALUATE_MS = 500;

let hydrationTimer: ReturnType<typeof setTimeout> | null = null;

function redirectFor(reason: Reason): void {
  if (reason.kind === 'area') {
    window.location.replace(YOUTUBE_HOME);
    return;
  }
  const url = new URL(getRuntimeUrl(BLOCKED_PAGE));
  url.searchParams.set('reason', formatReason(reason));
  window.location.replace(url.toString());
}

const SUPPORTED_KINDS: ReadonlySet<ParsedUrl['kind']> = new Set([
  'video',
  'shorts',
  'live',
  'embed',
  'channel',
  'handle',
]);

function isSupportedPage(parsed: ParsedUrl): boolean {
  return SUPPORTED_KINDS.has(parsed.kind);
}

function evaluateBlocking(): void {
  const snapshot = getSnapshot();
  if (!snapshot) return;
  if (window.top !== window) return;
  const { state, compiled } = snapshot;

  if (!state.settings.enabled) {
    clearFeedback();
    return;
  }

  const path = window.location.pathname;
  const parsed = parseYouTubeUrl(window.location.href);

  const area = matchAreaRedirect(path, state.areas);
  if (area.blocked) {
    redirectFor(area.reason);
    return;
  }

  if (!isSupportedPage(parsed)) {
    clearFeedback();
    return;
  }

  const entity = currentContext();
  const result = matchEntity(entity, compiled);
  if (result.blocked) {
    if (result.reason.kind === 'video') {
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
  evaluateBlocking();
  if (hydrationTimer !== null) clearTimeout(hydrationTimer);
  hydrationTimer = setTimeout(() => {
    hydrationTimer = null;
    evaluateBlocking();
  }, HYDRATION_EVALUATE_MS);
}
