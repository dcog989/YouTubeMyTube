import { type Backup, readBackup } from '../shared/backup';
import { mergeBlockTubeImport, parseBlockTubeBackup } from '../shared/blocktube';
import { t } from '../shared/i18n';
import { normalizeState, ruleCount } from '../shared/normalize';
import { byId, h } from '../shared/ui';
import { backfillMissing } from './backfill';
import { confirmAction } from './confirm';
import { setStatus } from './dom';
import { getDraft, isDirty, notify, setDirty, setDraft } from './state';

// A settings export is a few KB; anything this large is the wrong file and
// would freeze the page while it is parsed.
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

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

// Shows when the last snapshot was taken and how much it holds. A backup with
// no rules is the same as none: there is nothing to restore.
export async function renderBackup(): Promise<void> {
  let backup: Backup | undefined;
  try {
    backup = await readBackup();
  } catch {
    backup = undefined;
  }
  const count = backup ? ruleCount(backup.state) : 0;
  byId('backup-status').textContent =
    backup && count > 0
      ? t('backupInfo', [new Date(backup.savedAt).toLocaleDateString(), String(count)])
      : t('backupNone');
}

export async function restoreBackup(): Promise<void> {
  let backup: Backup | undefined;
  try {
    backup = await readBackup();
  } catch {
    backup = undefined;
  }
  if (!backup || ruleCount(backup.state) === 0) {
    setStatus('import-status', t('backupNone'), false);
    return;
  }
  // readBackup already normalized the snapshot; it restores as a draft so the
  // user can inspect it before saving.
  if (isDirty() && !(await confirmAction(t('confirmImport')))) return;
  setDraft(backup.state);
  notify();
  setDirty(true);
  setStatus('import-status', t('backupRestored'), true);
}

// `normalizeState` fills every missing section, so a native export only needs a
// rules object; older backups predate some of the lists.
function isBlockerState(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const rules = (value as { rules?: unknown }).rules;
  return Boolean(rules) && typeof rules === 'object';
}

function scheduleBackfill(): void {
  void backfillMissing().catch((error) => {
    console.error('Backfill failed', error);
  });
}

export async function importSettings(file: File): Promise<void> {
  if (file.size > MAX_IMPORT_BYTES) {
    setStatus('import-status', t('importTooLarge'), false);
    return;
  }

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
    // A native import replaces the draft; a BlockTube backup merges into it.
    if (isDirty() && !(await confirmAction(t('confirmImport')))) return;
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
