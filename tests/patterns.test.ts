import { describe, expect, it } from 'vitest';
import {
  compilePatterns,
  countActiveEntries,
  isActiveEntry,
  parsePattern,
  sortEntries,
} from '../src/shared/patterns';

describe('isActiveEntry / countActiveEntries', () => {
  it('ignores blank and comment entries after trimming', () => {
    expect(isActiveEntry(' hello ')).toBe(true);
    expect(isActiveEntry('// note')).toBe(false);
    expect(isActiveEntry('  // note')).toBe(false);
    expect(isActiveEntry('   ')).toBe(false);
    expect(countActiveEntries(['a', '// b', '  // c', '', ' d '])).toBe(2);
  });
});

describe('sortEntries', () => {
  it('sorts case-insensitively without mutating the input', () => {
    const input = ['Banana', 'apple', 'cherry'];
    expect(sortEntries(input)).toEqual(['apple', 'Banana', 'cherry']);
    expect(input).toEqual(['Banana', 'apple', 'cherry']);
  });
});

describe('parsePattern', () => {
  it('compiles keyword entries case-insensitively', () => {
    const pattern = parsePattern('Drama');
    expect(pattern?.test('daily DRAMA recap')).toBe(true);
    expect(pattern?.test('comedy')).toBe(false);
  });

  it('compiles /pattern/flags entries as regular expressions', () => {
    const pattern = parsePattern('/\\bspoiler(s)?\\b/i');
    expect(pattern?.test('Ending Spoilers revealed')).toBe(true);
  });

  it('strips global and sticky flags', () => {
    const pattern = parsePattern('/needle/g');
    expect(pattern?.flags).toBe('i');
  });

  it('returns null for malformed or inactive entries', () => {
    expect(parsePattern('/[unclosed/')).toBeNull();
    expect(parsePattern('// note')).toBeNull();
    expect(parsePattern('   ')).toBeNull();
  });
});

describe('compilePatterns', () => {
  it('drops malformed patterns', () => {
    expect(compilePatterns(['/[unclosed/', 'ok'])).toHaveLength(1);
  });
});
