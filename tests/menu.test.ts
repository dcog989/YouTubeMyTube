import { describe, expect, it } from 'vitest';
import { actionsFor } from '../src/content/menu/actions';
import type { FilterRules } from '../src/shared/types';

function rules(overrides: Partial<FilterRules> = {}): FilterRules {
  return {
    channels: [],
    videos: [],
    channelFilters: [],
    titleFilters: [],
    commentFilters: [],
    ...overrides,
  };
}

describe('actionsFor', () => {
  it('offers to block an unblocked video and to unblock a stored one', () => {
    expect(actionsFor({ videoId: 'dQw4w9WgXcQ' }, rules())).toMatchObject([
      { kind: 'video', mode: 'block', entry: { id: 'dQw4w9WgXcQ' } },
    ]);
    expect(
      actionsFor({ videoId: 'dQw4w9WgXcQ' }, rules({ videos: [{ id: 'dQw4w9WgXcQ', title: '' }] })),
    ).toMatchObject([{ kind: 'video', mode: 'unblock' }]);
  });

  it('matches a stored channel by handle, ignoring the @ and case', () => {
    const stored = rules({ channels: [{ id: '', name: 'Rick Astley', handle: 'rickastley' }] });
    expect(actionsFor({ handle: 'RickAstley' }, stored)).toMatchObject([
      { kind: 'channel', mode: 'unblock' },
    ]);
  });

  it('matches a name-only row by display name', () => {
    const stored = rules({ channels: [{ id: '', name: 'Some Channel', handle: '' }] });
    expect(actionsFor({ channelName: 'Some Channel' }, stored)).toMatchObject([
      { kind: 'channel', mode: 'unblock' },
    ]);
  });

  it('returns no actions when the entity has no identity', () => {
    expect(actionsFor({}, rules())).toEqual([]);
  });
});
