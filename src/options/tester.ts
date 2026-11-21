import { t } from '../shared/i18n';
import { matchDirectNavigation, matchEntity } from '../shared/match';
import { reasonDetail } from '../shared/reason-copy';
import { parseBlockInput } from '../shared/resolve';
import { compileRules } from '../shared/rules';
import type { BlockerState, Entity, MatchResult, ParsedUrl } from '../shared/types';
import { byId } from '../shared/ui';
import { parseYouTubeUrl, pathnameFrom } from '../shared/url';
import { setStatus } from './dom';
import { getDraft } from './state';

function showResult(blocked: boolean | null, message: string): void {
  setStatus('test-result', blocked === null ? '' : message, !blocked);
}

function blockedMessage(result: MatchResult): string {
  return result.blocked ? reasonDetail(result.reason) : t('notBlocked');
}

// The Add boxes accept bare ids and handles; the tester has to accept the same
// forms instead of calling them "not blocked".
function targetFromInput(value: string): ParsedUrl {
  const parsed = parseYouTubeUrl(value);
  if (parsed.kind !== 'other') return parsed;
  const input = parseBlockInput(value);
  if (input?.kind === 'video') return { kind: 'video', videoId: input.videoId };
  if (input?.kind === 'channel') {
    return { kind: 'channel', channelId: input.channelId, handle: input.handle };
  }
  return parsed;
}

export function evaluateUrl(value: string, state: BlockerState): MatchResult {
  return matchDirectNavigation(
    targetFromInput(value),
    pathnameFrom(value),
    compileRules(state.rules),
    state.areas,
  );
}

export function testUrl(): void {
  const value = byId<HTMLInputElement>('test-url').value.trim();
  if (!value) {
    showResult(null, '');
    return;
  }
  const result = evaluateUrl(value, getDraft());
  showResult(result.blocked, blockedMessage(result));
}

export function testText(): void {
  const type = byId<HTMLSelectElement>('test-type').value;
  const value = byId<HTMLInputElement>('test-text').value;
  if (!value) {
    showResult(null, '');
    return;
  }
  const entity = { [type]: value } as Entity;

  const result = matchEntity(entity, compileRules(getDraft().rules));
  showResult(result.blocked, blockedMessage(result));
}
