import { describe, expect, it } from 'vitest';
import {
  compilePatterns,
  countActiveEntries,
  invalidPatterns,
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

  it('keeps comment runs attached to the entry they describe', () => {
    const input = ['// music', 'zebra', '// animals', 'ant'];
    expect(sortEntries(input)).toEqual(['// animals', 'ant', '// music', 'zebra']);
  });

  it('leaves trailing comments and blanks at the end', () => {
    expect(sortEntries(['b', 'a', '// trailing'])).toEqual(['a', 'b', '// trailing']);
    expect(sortEntries(['b', '// note', 'a'])).toEqual(['// note', 'a', 'b']);
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

  it('keeps the flags the user wrote', () => {
    expect(parsePattern('/Drama/')?.test('drama')).toBe(false);
    expect(parsePattern('/Drama/i')?.test('drama')).toBe(true);
  });

  it('strips global and sticky flags', () => {
    expect(parsePattern('/needle/g')?.flags).toBe('');
    expect(parsePattern('/needle/gy')?.flags).toBe('');
  });

  it('rejects nested quantifiers that can freeze the page', () => {
    expect(parsePattern('/^(a+)+$/')).toBeNull();
    expect(parsePattern('/(a*)+/')).toBeNull();
    expect(parsePattern('/(a?)+/')).toBeNull();
    expect(parsePattern('/(\\d+){2,}/')).toBeNull();
  });

  it('keeps safe groups with quantifiers', () => {
    expect(parsePattern('/(ab)+/')).not.toBeNull();
    expect(parsePattern('/(a+)?/')).not.toBeNull();
    expect(parsePattern('/(\\d+){2}/')).not.toBeNull();
    expect(parsePattern('/[(a+)+]/')).not.toBeNull();
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

describe('invalidPatterns', () => {
  it('reports active regex entries that fail to compile', () => {
    expect(invalidPatterns(['/[unclosed/', 'ok', '// note', '/fine/i'])).toEqual(['/[unclosed/']);
    expect(invalidPatterns(['/(a+)+/'])).toEqual(['/(a+)+/']);
  });
});
