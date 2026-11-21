import { describe, expect, it } from 'vitest';
import { evaluateUrl } from '../src/options/tester';
import { defaultState } from '../src/shared/defaults';

describe('evaluateUrl', () => {
  it('matches an area from a scheme-less URL', () => {
    const state = defaultState();
    state.areas.trendingPage = true;

    expect(evaluateUrl('youtube.com/feed/trending', state)).toEqual({
      blocked: true,
      reason: { kind: 'area', value: 'trendingPage' },
    });
    expect(evaluateUrl('https://www.youtube.com/feed/trending', state).blocked).toBe(true);
    expect(evaluateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', state).blocked).toBe(false);
  });

  it('accepts a bare video id like the Add box', () => {
    const state = defaultState();
    state.rules.videos.push({ id: 'dQw4w9WgXcQ', title: '' });

    expect(evaluateUrl('dQw4w9WgXcQ', state)).toEqual({
      blocked: true,
      reason: { kind: 'video', value: 'dQw4w9WgXcQ' },
    });
  });

  it('accepts a bare handle like the Add box', () => {
    const state = defaultState();
    state.rules.channels.push({ id: '', name: '', handle: 'somehandle' });

    expect(evaluateUrl('@SomeHandle', state).blocked).toBe(true);
  });
});
