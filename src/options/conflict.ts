import type { BlockerState } from '../shared/types';

// Pure decision for a stored-state write seen while the options page is open.
export type ExternalChange =
  | { kind: 'ignore' }
  | { kind: 'saving' }
  | { kind: 'onboarding'; onboardingComplete: boolean }
  | { kind: 'adopt' }
  | { kind: 'conflict' };

function differsOnlyByOnboarding(incoming: BlockerState, baselineJson: string): boolean {
  if (baselineJson === '') return false;
  const baseline = JSON.parse(baselineJson) as BlockerState;
  if (incoming.settings.onboardingComplete === baseline.settings.onboardingComplete) return false;
  const withoutOnboarding: BlockerState = {
    ...incoming,
    settings: {
      ...incoming.settings,
      onboardingComplete: baseline.settings.onboardingComplete,
    },
  };
  return JSON.stringify(withoutOnboarding) === baselineJson;
}

// shortcut: each storage write is compared as a full normalized JSON string;
// fine while the DNR cap keeps state near 1 MB, move to a revision counter if
// blocklists grow far past it.
export function classifyExternalChange(
  incoming: BlockerState,
  savedSnapshot: string,
  dirty: boolean,
  saving: boolean,
): ExternalChange {
  if (JSON.stringify(incoming) === savedSnapshot) return { kind: 'ignore' };
  // A write during our own save is resolved once that save settles.
  if (saving) return { kind: 'saving' };
  if (differsOnlyByOnboarding(incoming, savedSnapshot)) {
    return { kind: 'onboarding', onboardingComplete: incoming.settings.onboardingComplete };
  }
  return dirty ? { kind: 'conflict' } : { kind: 'adopt' };
}
