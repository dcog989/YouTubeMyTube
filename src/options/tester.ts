import { YOUTUBE_ORIGIN } from '../shared/constants';
import { matchDirectNavigation, matchEntity } from '../shared/match';
import { reasonDetail } from '../shared/reason';
import { compileRules } from '../shared/rules';
import type { Entity, MatchResult } from '../shared/types';
import { byId } from '../shared/ui';
import { parseYouTubeUrl } from '../shared/url';
import { setStatus } from './dom';
import { getDraft } from './state';

function showResult(blocked: boolean | null, message: string): void {
  setStatus('test-result', blocked === null ? '' : message, !blocked);
}

function blockedMessage(result: MatchResult): string {
  return result.blocked ? reasonDetail(result.reason) : 'Not blocked';
}

function pathnameOf(value: string): string {
  try {
    return new URL(value, YOUTUBE_ORIGIN).pathname;
  } catch {
    return '/';
  }
}

export function testUrl(): void {
  const value = byId<HTMLInputElement>('test-url').value.trim();
  if (!value) {
    showResult(null, '');
    return;
  }
  const draft = getDraft();
  const parsed = parseYouTubeUrl(value);
  const compiled = compileRules(draft.rules);
  const result = matchDirectNavigation(parsed, pathnameOf(value), compiled, draft.areas);
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
