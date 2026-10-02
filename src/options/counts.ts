import { MAX_DNR_REGEX_RULES } from '../shared/constants';
import { countDnrRules } from '../shared/dnr';
import { t } from '../shared/i18n';
import { type RuleSummary, summarizeRules } from '../shared/normalize';
import { byId } from '../shared/ui';
import { getActivePanel } from './dom';
import { getDraft } from './state';

const COUNTED_PANELS = ['channels', 'videos', 'comments', 'areas'] as const;
const COUNTED_PANEL_SET = new Set<string>(COUNTED_PANELS);

function panelFilterCount(summary: RuleSummary, panel: string): number {
  switch (panel) {
    case 'channels':
      return summary.channels + summary.channelFilters;
    case 'videos':
      return summary.videos + summary.titleFilters;
    case 'comments':
      return summary.commentFilters;
    case 'areas':
      return summary.areas;
    default:
      return 0;
  }
}

function formatCount(count: number): string {
  return count === 1 ? t('countFilter') : t('countFilters', String(count));
}

function updateDnrWarning(): void {
  const notice = byId('dnr-warning');
  const dropped = Math.max(0, countDnrRules(getDraft()) - MAX_DNR_REGEX_RULES);
  notice.hidden = dropped === 0;
  notice.textContent =
    dropped === 0
      ? ''
      : dropped === 1
        ? t('dnrWarningOne', String(MAX_DNR_REGEX_RULES))
        : t('dnrWarningMany', [String(dropped), String(MAX_DNR_REGEX_RULES)]);
}

export function updateCounts(): void {
  const summary = summarizeRules(getDraft());
  const activePanel = getActivePanel();
  const isCounted = COUNTED_PANEL_SET.has(activePanel);
  byId('panel-count').textContent = isCounted
    ? formatCount(panelFilterCount(summary, activePanel))
    : '';
  const total = COUNTED_PANELS.reduce((sum, panel) => sum + panelFilterCount(summary, panel), 0);
  byId('total-count').textContent = formatCount(total);
  updateDnrWarning();
}
