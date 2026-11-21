import { YOUTUBE_HOME } from '../shared/constants';
import { matchAreaRedirect, matchEntity } from '../shared/match';
import type { CompiledRules, Entity, ParsedUrl } from '../shared/types';
import { parseYouTubeUrl } from '../shared/url';
import { createCoalescer } from './batch';
import { currentContext, entityKey, isInOwnerScope, isInPageTitleScope } from './entity';
import type { OverlayFeedback } from './overlay';
import type { Store } from './store';

const HYDRATION_EVALUATE_MS = 500;
// Cap on waiting for the page's channel/title before releasing a preemptively
// hidden player; without it a markup change would blank every video.
const IDENTITY_WAIT_MS = 3000;

const SUPPORTED_KINDS: ReadonlySet<ParsedUrl['kind']> = new Set([
  'video',
  'shorts',
  'live',
  'embed',
  'channel',
  'handle',
]);

const VIDEO_KINDS: ReadonlySet<ParsedUrl['kind']> = new Set(['video', 'shorts', 'live', 'embed']);

// Hide before the first decision on pages that render a player early. The
// Shorts cover is passive, so the pager still scrolls while it is shown.
export const PENDING_KINDS: ReadonlySet<ParsedUrl['kind']> = new Set(['video', 'live', 'shorts']);

// A full-page overlay would swallow the Shorts pager's scroll input, and the
// full-page channel overlay hides the page UI a video block only needs to cover.
export function blockSurface(kind: ParsedUrl['kind']): 'blank' | 'channel' {
  return VIDEO_KINDS.has(kind) ? 'blank' : 'channel';
}

function needsIdentity(rules: CompiledRules): boolean {
  return (
    rules.channelIds.size > 0 ||
    rules.handles.size > 0 ||
    rules.channelNames.size > 0 ||
    rules.channelFilters.length > 0 ||
    rules.titleFilters.length > 0
  );
}

function hasPageIdentity(entity: Entity): boolean {
  return Boolean(entity.channelId || entity.handle || entity.channelName || entity.title);
}

function isSupportedPage(parsed: ParsedUrl): boolean {
  return SUPPORTED_KINDS.has(parsed.kind);
}

function isRelevantNode(node: Element): boolean {
  // Page microdata is the first place the channel appears; the player DOM comes later.
  return isInOwnerScope(node) || isInPageTitleScope(node) || node.matches('[itemprop], title');
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
    lastIdentity = entityKey(entity);
    const result = matchEntity(entity, compiled);
    if (result.blocked) {
      if (blockSurface(parsed.kind) === 'blank') {
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

    // Keep the player hide that content.ts applied at document_start until the
    // channel/title rules can actually be checked against the page.
    if (
      PENDING_KINDS.has(parsed.kind) &&
      needsIdentity(compiled) &&
      !hasPageIdentity(entity) &&
      performance.now() < IDENTITY_WAIT_MS
    ) {
      recheck.schedule();
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
      if (entityKey(currentContext()) === lastIdentity) return;
      mutationCheck.schedule();
    },
  };
}
