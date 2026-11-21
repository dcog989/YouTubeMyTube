import { mergeBlockTubeImport, parseBlockTubeBackup } from '../shared/blocktube';
import { t } from '../shared/i18n';
import { normalizeState } from '../shared/normalize';
import { h } from '../shared/ui';
import { backfillMissing } from './backfill';
import { setStatus } from './dom';
import { getDraft, notify, setDirty, setDraft } from './state';

let exportUrl: string | null = null;

function releaseExportUrl(): void {
  if (!exportUrl) return;
  URL.revokeObjectURL(exportUrl);
  exportUrl = null;
}

export function exportSettings(): void {
  const blob = new Blob([JSON.stringify(normalizeState(getDraft()), null, 2)], {
    type: 'application/json',
  });
  releaseExportUrl();
  const url = URL.createObjectURL(blob);
  exportUrl = url;
  h('a', { href: url, download: 'YouTubeMyTube-settings.json' }).click();
}

window.addEventListener('pagehide', releaseExportUrl);

const RULE_ARRAYS = [
  'channels',
  'videos',
  'channelFilters',
  'titleFilters',
  'commentFilters',
] as const;

function isBlockerState(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const rules = (value as { rules?: unknown }).rules;
  if (!rules || typeof rules !== 'object') return false;
  const record = rules as Record<string, unknown>;
  return RULE_ARRAYS.every((key) => Array.isArray(record[key]));
}

function scheduleBackfill(): void {
  void backfillMissing().catch((error) => {
    console.error('Backfill failed', error);
  });
}

export async function importSettings(file: File): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    setStatus('import-status', t('importInvalidJson'), false);
    return;
  }

  const blocktube = parseBlockTubeBackup(parsed);
  if (blocktube) {
    const { state: merged, added } = mergeBlockTubeImport(getDraft(), blocktube);
    merged.settings.onboardingComplete = true;
    setDraft(merged);
    notify();
    setDirty(true);
    const filters = t(added === 1 ? 'importFilterOne' : 'importFilterMany', String(added));
    const skipped = blocktube.skipped.length
      ? ` ${t('importSkipped', blocktube.skipped.join(', '))}`
      : '';
    setStatus('import-status', `${t('importBlockTube', filters)}${skipped}`, true);
    scheduleBackfill();
    return;
  }

  if (isBlockerState(parsed)) {
    const imported = normalizeState(parsed);
    imported.settings.onboardingComplete = true;
    setDraft(imported);
    notify();
    setDirty(true);
    setStatus('import-status', t('importNative'), true);
    scheduleBackfill();
    return;
  }

  setStatus('import-status', t('importUnknown'), false);
}
