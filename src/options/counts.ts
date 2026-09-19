import { AREA_DEFINITIONS } from '../shared/areas';
import { MAX_DNR_REGEX_RULES } from '../shared/constants';
import { buildDnrRules } from '../shared/dnr';
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
  return count === 1 ? '1 filter' : `${count} filters`;
}

function updateDnrWarning(): void {
  const notice = byId('dnr-warning');
  const { dropped } = buildDnrRules(getDraft());
  const noun = dropped === 1 ? 'filter' : 'filters';
  const verb = dropped === 1 ? 'exceeds' : 'exceed';
  notice.hidden = dropped === 0;
  const limit = `${MAX_DNR_REGEX_RULES}-rule limit`;
  notice.textContent =
    dropped === 0
      ? ''
      : `${dropped} ${noun} ${verb} the browser's ${limit} and will be enforced in-page only.`;
}

export function updateCounts(): void {
  const isCounted = COUNTED_PANEL_SET.has(activePanel);
  byId('panel-count').textContent = isCounted ? formatCount(panelFilterCount(activePanel)) : '';
  const total = COUNTED_PANELS.reduce((sum, panel) => sum + panelFilterCount(panel), 0);
  byId('total-count').textContent = formatCount(total);
  updateDnrWarning();
}
