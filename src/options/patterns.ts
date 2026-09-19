import { PATTERN_FILTER_KEYS, type PatternFilterKey } from '../shared/filters';
import { byId } from '../shared/ui';
import { updateCounts } from './counts';
import { arrayToLines, autoGrowTextarea, linesToArray } from './dom';
import { getDraft, setDirty } from './state';

const patternEditors = new Map<PatternFilterKey, HTMLTextAreaElement>();

export function wirePatternEditors(): void {
  for (const key of PATTERN_FILTER_KEYS) {
    const textarea = byId<HTMLTextAreaElement>(`input-${key}`);
    textarea.addEventListener('input', () => {
      getDraft().rules[key] = linesToArray(textarea.value);
      updateCounts();
      setDirty(true);
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
      editor.value = arrayToLines(draft.rules[key]);
      if (editor.offsetParent) autoGrowTextarea(editor);
    }
  }
}
