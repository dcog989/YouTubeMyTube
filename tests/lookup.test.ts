import { describe, expect, it } from 'vitest';
import { channelAddStep, videoLookupApplies } from '../src/options/lookup';
import { defaultRules } from '../src/shared/defaults';

const before = { id: '', name: '', handle: 'somechannel' };
const stored = { id: '', name: '', handle: 'somechannel' };
const emptyMeta = { id: '', name: '', handle: '' };

describe('channelAddStep', () => {
  it('discards an entry that left the draft', () => {
    expect(channelAddStep(undefined, before, 'somechannel', emptyMeta)).toBe('stale');
  });

  it('discards an entry the user edited during the lookup', () => {
    expect(channelAddStep({ ...stored, id: 'UCmanual' }, before, 'somechannel', emptyMeta)).toBe(
      'stale',
    );
    expect(channelAddStep({ ...stored, name: 'Edited' }, before, 'somechannel', emptyMeta)).toBe(
      'stale',
    );
    expect(channelAddStep({ ...stored, handle: 'other' }, before, 'somechannel', emptyMeta)).toBe(
      'stale',
    );
  });

  it('removes a handle that was not found', () => {
    expect(channelAddStep({ ...stored }, before, 'somechannel', emptyMeta)).toBe('not-found');
  });

  it('applies a resolved channel or a name-only add', () => {
    expect(
      channelAddStep({ ...stored }, before, 'somechannel', {
        id: 'UC1',
        name: 'Name',
        handle: 'somechannel',
      }),
    ).toBe('apply');
    const nameOnly = { id: '', name: 'Music', handle: '' };
    expect(channelAddStep({ ...nameOnly }, nameOnly, '', emptyMeta)).toBe('apply');
  });
});

describe('videoLookupApplies', () => {
  it('skips a video that was removed or had its id edited', () => {
    const rules = defaultRules();
    const entry = { id: 'abc', title: '' };
    rules.videos.push(entry);
    expect(videoLookupApplies(rules, entry, 'abc')).toBe(true);
    expect(videoLookupApplies(rules, entry, 'different')).toBe(false);
    expect(videoLookupApplies(rules, { id: 'gone', title: '' }, 'gone')).toBe(false);
  });
});
