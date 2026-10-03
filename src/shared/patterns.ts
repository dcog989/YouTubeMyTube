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

export function parsePattern(raw: string): RegExp | null {
  const trimmed = raw.trim();
  if (!isActiveEntry(trimmed)) return null;

  const regexForm = /^\/(.*)\/([a-z]*)$/i.exec(trimmed);
  if (regexForm) {
    const source = regexForm[1] ?? '';
    // `g`/`y` are stateful with reused `test()` calls; drop them.
    const flags = (regexForm[2] ?? '').replace(/[gy]/gi, '') || 'i';
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
