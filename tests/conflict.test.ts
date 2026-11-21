import { describe, expect, it } from 'vitest';
import { classifyExternalChange } from '../src/options/conflict';
import { defaultState } from '../src/shared/defaults';
import type { BlockerState } from '../src/shared/types';

function changed(update: (state: BlockerState) => void): BlockerState {
  const state = defaultState();
  update(state);
  return state;
}

describe('classifyExternalChange', () => {
  const baselineJson = JSON.stringify(defaultState());

  it('ignores the write that matches the saved snapshot', () => {
    expect(classifyExternalChange(defaultState(), baselineJson, true, false)).toEqual({
      kind: 'ignore',
    });
  });

  it('adopts a clean external write', () => {
    const incoming = changed((state) => state.rules.videos.push({ id: 'abcdefghijk', title: '' }));
    expect(classifyExternalChange(incoming, baselineJson, false, false)).toEqual({ kind: 'adopt' });
  });

  it('reports a conflict over unsaved edits', () => {
    const incoming = changed((state) => state.rules.videos.push({ id: 'abcdefghijk', title: '' }));
    expect(classifyExternalChange(incoming, baselineJson, true, false)).toEqual({
      kind: 'conflict',
    });
  });

  it('absorbs an onboarding-only write and reports the stored value', () => {
    const incoming = changed((state) => {
      state.settings.onboardingComplete = true;
    });
    expect(classifyExternalChange(incoming, baselineJson, true, false)).toEqual({
      kind: 'onboarding',
      onboardingComplete: true,
    });
  });

  it('treats onboarding plus another change as a real change', () => {
    const incoming = changed((state) => {
      state.settings.onboardingComplete = true;
      state.settings.enabled = false;
    });
    expect(classifyExternalChange(incoming, baselineJson, true, false)).toEqual({
      kind: 'conflict',
    });
  });

  it('tracks writes seen during a save instead of adopting them', () => {
    const incoming = changed((state) => {
      state.settings.enabled = false;
    });
    expect(classifyExternalChange(incoming, baselineJson, true, true)).toEqual({ kind: 'saving' });
  });

  it('has no onboarding baseline before the first load', () => {
    expect(classifyExternalChange(defaultState(), '', false, false)).toEqual({ kind: 'adopt' });
  });
});
