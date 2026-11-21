export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isActiveEntry(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.startsWith('//');
}

export function countActiveEntries(entries: string[]): number {
  return entries.filter((entry) => isActiveEntry(entry)).length;
}

function compareEntries(a: string, b: string): number {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA < lowerB) return -1;
  if (lowerA > lowerB) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortEntries(entries: string[]): string[] {
  // Keep `//` comment runs (and blank separators) attached to the entry they
  // describe so sorting does not strip comments away to the top of the list.
  const blocks: Array<{ entry: string; lines: string[] }> = [];
  let pending: string[] = [];
  for (const line of entries) {
    if (isActiveEntry(line)) {
      blocks.push({ entry: line, lines: [...pending, line] });
      pending = [];
    } else {
      pending.push(line);
    }
  }
  blocks.sort((a, b) => compareEntries(a.entry, b.entry));
  return [...blocks.flatMap((block) => block.lines), ...pending];
}

function isUnboundedBrace(source: string, index: number): boolean {
  const end = source.indexOf('}', index);
  if (end === -1) return false;
  return /^\{\d*,\s*\}$/.test(source.slice(index, end + 1));
}

// Reject a quantified group that repeats a quantifier, e.g. `(a+)+`. A user or
// imported regex like that backtracks for seconds and freezes the page, and
// JavaScript gives no way to time out a running match. This is a heuristic: it
// catches the common catastrophic forms, not every slow regex.
function hasNestedQuantifier(source: string): boolean {
  const groups: Array<{ quantified: boolean }> = [{ quantified: false }];
  let escaped = false;
  let inClass = false;
  let groupStart = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] ?? '';
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      groupStart = false;
      continue;
    }
    if (inClass) {
      if (char === ']') inClass = false;
      continue;
    }
    if (char === '[') {
      inClass = true;
      groupStart = false;
      continue;
    }
    if (char === '(') {
      groups.push({ quantified: false });
      groupStart = true;
      continue;
    }
    if (char === ')') {
      const group = groups.pop() ?? { quantified: false };
      const next = source[i + 1];
      const outer =
        next === '*' || next === '+' || (next === '{' && isUnboundedBrace(source, i + 1));
      if (outer && group.quantified) return true;
      if (outer || group.quantified) {
        const parent = groups[groups.length - 1];
        if (parent) parent.quantified = true;
      }
      groupStart = false;
      continue;
    }
    if (char === '*' || char === '+' || char === '?' || char === '{') {
      // `?` right after `(` marks a group modifier (`?:`, `?=`, `?<name>`), not
      // a quantifier.
      if (groupStart && char === '?') {
        groupStart = false;
        continue;
      }
      const current = groups[groups.length - 1];
      if (current) current.quantified = true;
    }
    groupStart = false;
  }

  return false;
}

export function parsePattern(raw: string): RegExp | null {
  const trimmed = raw.trim();
  if (!isActiveEntry(trimmed)) return null;

  const regexForm = /^\/(.*)\/([a-z]*)$/i.exec(trimmed);
  if (regexForm) {
    const source = regexForm[1] ?? '';
    // `g`/`y` are stateful with reused `test()` calls; drop them.
    const flags = (regexForm[2] ?? '').replace(/[gy]/gi, '');
    if (hasNestedQuantifier(source)) return null;
    try {
      return new RegExp(source, flags);
    } catch {
      return null;
    }
  }

  return new RegExp(escapeRegExp(trimmed), 'i');
}

export function invalidPatterns(entries: string[]): string[] {
  return entries.filter((entry) => isActiveEntry(entry) && parsePattern(entry) === null);
}

export function compilePatterns(entries: string[]): RegExp[] {
  const compiled: RegExp[] = [];
  for (const raw of entries) {
    const regex = parsePattern(raw);
    if (regex) compiled.push(regex);
  }
  return compiled;
}
