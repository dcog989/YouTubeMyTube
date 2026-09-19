import { BLOCKED_PAGE, YOUTUBE_HOME } from '../shared/constants';
import { matchAreaRedirect, matchEntity } from '../shared/match';
import { formatReason, type Reason } from '../shared/reason';
import { getRuntimeUrl } from '../shared/runtime';
import type { BlockerState, CompiledRules, ParsedUrl } from '../shared/types';
import { parseYouTubeUrl } from '../shared/url';
import { createCoalescer } from './batch';
import { currentContext } from './entity';
import type { OverlayFeedback } from './overlay';

const HYDRATION_EVALUATE_MS = 500;

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

function redirectFor(reason: Reason): void {
  if (reason.kind === 'area') {
    window.location.replace(YOUTUBE_HOME);
    return;
  }
  const url = new URL(getRuntimeUrl(BLOCKED_PAGE));
  url.searchParams.set('reason', formatReason(reason));
  window.location.replace(url.toString());
}

export interface Evaluator {
  schedule(): void;
}

export function createEvaluator(deps: {
  getSnapshot(): { state: BlockerState; compiled: CompiledRules } | null;
  overlay: OverlayFeedback;
}): Evaluator {
  function evaluateBlocking(): void {
    const snapshot = deps.getSnapshot();
    if (!snapshot) return;
    if (window.top !== window) return;
    const { state, compiled } = snapshot;

    if (!state.settings.enabled) {
      deps.overlay.clear();
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
      deps.overlay.clear();
      return;
    }

    const entity = currentContext();
    const result = matchEntity(entity, compiled);
    if (result.blocked) {
      if (result.reason.kind === 'video') {
        deps.overlay.clearChannel();
        deps.overlay.requestBlank(true, result.reason);
        return;
      }
      deps.overlay.requestBlank(false);
      deps.overlay.showChannel({
        reason: result.reason,
        name: entity.channelName,
        id: entity.channelId ?? (entity.handle ? `@${entity.handle}` : undefined),
      });
      return;
    }

    deps.overlay.clear();
  }

  const recheck = createCoalescer(() => evaluateBlocking(), { delayMs: HYDRATION_EVALUATE_MS });

  return {
    schedule() {
      evaluateBlocking();
      recheck.schedule();
    },
  };
}
