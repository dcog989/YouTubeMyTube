import { YOUTUBE_HOME } from '../shared/constants';
import { matchAreaRedirect, matchEntity } from '../shared/match';
import type { Entity, ParsedUrl } from '../shared/types';
import { parseYouTubeUrl } from '../shared/url';
import { createCoalescer } from './batch';
import { currentContext, isInOwnerScope, isInPageTitleScope } from './entity';
import type { OverlayFeedback } from './overlay';
import type { Store } from './store';

const HYDRATION_EVALUATE_MS = 500;

const SUPPORTED_KINDS: ReadonlySet<ParsedUrl['kind']> = new Set([
  'video',
  'shorts',
  'live',
  'embed',
  'channel',
  'handle',
]);

const PLAYER_BLANK_KINDS: ReadonlySet<string> = new Set(['video', 'title']);

function isSupportedPage(parsed: ParsedUrl): boolean {
  return SUPPORTED_KINDS.has(parsed.kind);
}

function identityKey(entity: Entity): string {
  return [entity.videoId, entity.channelId, entity.handle, entity.channelName, entity.title]
    .filter((part): part is string => Boolean(part))
    .join('\u0000');
}

function isRelevantNode(node: Element): boolean {
  return isInOwnerScope(node) || isInPageTitleScope(node);
}

export interface Evaluator {
  schedule(): void;
  onMutation(nodes: Element[]): void;
}

export function createEvaluator(deps: { store: Store; overlay: OverlayFeedback }): Evaluator {
  let lastIdentity: string | null = null;

  function evaluateBlocking(): void {
    const snapshot = deps.store.getSnapshot();
    if (!snapshot) return;
    if (window.top !== window) return;
    const { state, compiled } = snapshot;

    if (!state.settings.enabled) {
      lastIdentity = null;
      deps.overlay.clear();
      return;
    }

    const path = window.location.pathname;
    const parsed = parseYouTubeUrl(window.location.href);

    const area = matchAreaRedirect(path, state.areas);
    if (area.blocked) {
      window.location.replace(YOUTUBE_HOME);
      return;
    }

    if (!isSupportedPage(parsed)) {
      lastIdentity = null;
      deps.overlay.clear();
      return;
    }

    const entity = currentContext();
    lastIdentity = identityKey(entity);
    const result = matchEntity(entity, compiled);
    if (result.blocked) {
      if (PLAYER_BLANK_KINDS.has(result.reason.kind)) {
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
  const mutationCheck = createCoalescer(() => evaluateBlocking());

  return {
    schedule() {
      evaluateBlocking();
      recheck.schedule();
    },
    onMutation(nodes) {
      const snapshot = deps.store.getSnapshot();
      if (!snapshot?.state.settings.enabled) return;
      if (window.top !== window) return;
      if (!isSupportedPage(parseYouTubeUrl(window.location.href))) return;
      if (!nodes.some(isRelevantNode)) return;
      if (identityKey(currentContext()) === lastIdentity) return;
      mutationCheck.schedule();
    },
  };
}
