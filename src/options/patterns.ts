import { PATTERN_FILTERS, type PatternFilterKey } from '../shared/filters';
import { byId } from '../shared/ui';
import { updateCounts } from './counts';
import { arrayToLines, autoGrowTextarea, linesToArray } from './dom';
import { getDraft, setDirty } from './state';

const patternEditors = new Map<PatternFilterKey, HTMLTextAreaElement>();

export function wirePatternEditors(): void {
  const draft = getDraft();
  for (const config of PATTERN_FILTERS) {
    const textarea = byId<HTMLTextAreaElement>(`input-${config.key}`);
    textarea.addEventListener('input', () => {
      draft.rules[config.key] = linesToArray(textarea.value);
      updateCounts();
      setDirty(true);
      autoGrowTextarea(textarea);
    });
    patternEditors.set(config.key, textarea);
  }
}

export function syncPatternEditors(): void {
  const draft = getDraft();
  for (const config of PATTERN_FILTERS) {
    const editor = patternEditors.get(config.key);
    if (editor) {
      editor.value = arrayToLines(draft.rules[config.key]);
      if (editor.offsetParent) autoGrowTextarea(editor);
    }
  }
}
