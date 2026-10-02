import { PATTERN_FILTER_KEYS, type PatternFilterKey } from '../shared/filters';
import { t } from '../shared/i18n';
import { invalidPatterns, sortEntries } from '../shared/patterns';
import { byId } from '../shared/ui';
import { updateCounts } from './counts';
import { arrayToLines, autoGrowTextarea, linesToArray } from './dom';
import { getDraft, setDirty } from './state';

const patternEditors = new Map<PatternFilterKey, HTMLTextAreaElement>();

function updatePatternWarnings(): void {
  const draft = getDraft();
  for (const key of PATTERN_FILTER_KEYS) {
    const warning = byId(`warning-${key}`);
    const invalid = invalidPatterns(draft.rules[key]);
    warning.hidden = invalid.length === 0;
    warning.textContent = invalid.length > 0 ? t('invalidPatterns', invalid.join(', ')) : '';
  }
}

function alphabetize(key: PatternFilterKey, textarea: HTMLTextAreaElement): boolean {
  const draft = getDraft();
  const current = draft.rules[key];
  const sorted = sortEntries(current);
  draft.rules[key] = sorted;
  textarea.value = arrayToLines(sorted);
  return sorted.join('\n') !== current.join('\n');
}

export function wirePatternEditors(): void {
  for (const key of PATTERN_FILTER_KEYS) {
    const textarea = byId<HTMLTextAreaElement>(`input-${key}`);
    textarea.addEventListener('input', () => {
      getDraft().rules[key] = linesToArray(textarea.value);
      updateCounts();
      updatePatternWarnings();
      setDirty(true);
      autoGrowTextarea(textarea);
    });
    textarea.addEventListener('blur', () => {
      if (alphabetize(key, textarea)) {
        updateCounts();
        setDirty(true);
      }
      updatePatternWarnings();
      autoGrowTextarea(textarea);
    });
    patternEditors.set(key, textarea);
  }
}

export function syncPatternEditors(): void {
  const draft = getDraft();
  for (const key of PATTERN_FILTER_KEYS) {
    const editor = patternEditors.get(key);
    if (editor) {
      editor.value = arrayToLines(sortEntries(draft.rules[key]));
      if (editor.offsetParent) autoGrowTextarea(editor);
    }
  }
  updatePatternWarnings();
}
