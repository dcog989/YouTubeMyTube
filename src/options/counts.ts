import { AREA_DEFINITIONS } from '../shared/areas';
import { MAX_DNR_REGEX_RULES } from '../shared/constants';
import { buildDnrRules } from '../shared/dnr';
import { t } from '../shared/i18n';
import { countActiveEntries } from '../shared/patterns';
import { byId } from '../shared/ui';
import { getDraft } from './state';

const COUNTED_PANELS = ['channels', 'videos', 'comments', 'areas'] as const;
const COUNTED_PANEL_SET = new Set<string>(COUNTED_PANELS);

let activePanel = 'channels';

export function setActivePanel(name: string): void {
  activePanel = name;
}

function panelFilterCount(panel: string): number {
  const draft = getDraft();
  const rules = draft.rules;
  switch (panel) {
    case 'channels':
      return rules.channels.length + countActiveEntries(rules.channelFilters);
    case 'videos':
      return rules.videos.length + countActiveEntries(rules.titleFilters);
    case 'comments':
      return countActiveEntries(rules.commentFilters);
    case 'areas':
      return AREA_DEFINITIONS.filter((area) => draft.areas[area.key]).length;
    default:
      return 0;
  }
}

function formatCount(count: number): string {
  return count === 1 ? t('countFilter') : t('countFilters', String(count));
}

function updateDnrWarning(): void {
  const notice = byId('dnr-warning');
  const { dropped } = buildDnrRules(getDraft());
  notice.hidden = dropped === 0;
  notice.textContent =
    dropped === 0
      ? ''
      : dropped === 1
        ? t('dnrWarningOne', String(MAX_DNR_REGEX_RULES))
        : t('dnrWarningMany', [String(dropped), String(MAX_DNR_REGEX_RULES)]);
}

export function updateCounts(): void {
  const isCounted = COUNTED_PANEL_SET.has(activePanel);
  byId('panel-count').textContent = isCounted ? formatCount(panelFilterCount(activePanel)) : '';
  const total = COUNTED_PANELS.reduce((sum, panel) => sum + panelFilterCount(panel), 0);
  byId('total-count').textContent = formatCount(total);
  updateDnrWarning();
}
