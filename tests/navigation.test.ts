import { describe, expect, it } from 'vitest';
import { entityUrlForReason } from '../src/shared/navigation';

describe('entityUrlForReason', () => {
  it('builds YouTube URLs for exact matches', () => {
    expect(entityUrlForReason({ kind: 'video', value: 'abc' })).toBe(
      'https://www.youtube.com/watch?v=abc',
    );
    expect(entityUrlForReason({ kind: 'channel', value: 'UC1' })).toBe(
      'https://www.youtube.com/channel/UC1',
    );
    expect(entityUrlForReason({ kind: 'handle', value: 'foo' })).toBe(
      'https://www.youtube.com/@foo',
    );
    expect(entityUrlForReason({ kind: 'handle', value: '@Foo' })).toBe(
      'https://www.youtube.com/@foo',
    );
  });

  it('returns null otherwise', () => {
    expect(entityUrlForReason({ kind: 'title', value: 'x' })).toBeNull();
    expect(entityUrlForReason({ kind: 'area', value: 'homePage' })).toBeNull();
    expect(entityUrlForReason(null)).toBeNull();
  });
});
