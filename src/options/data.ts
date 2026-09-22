import { mergeBlockTubeImport, parseBlockTubeBackup } from '../shared/blocktube';
import { normalizeState } from '../shared/normalize';
import { h } from '../shared/ui';
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

function isBlockerState(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return 'rules' in record || 'areas' in record || 'settings' in record;
}

export function importSettings(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(reader.result));
    } catch {
      setStatus('import-status', 'That file is not valid JSON.', false);
      return;
    }

    const blocktube = parseBlockTubeBackup(parsed);
    if (blocktube.ok) {
      const { state: merged, added } = mergeBlockTubeImport(getDraft(), blocktube.data);
      setDraft(merged);
      notify();
      setDirty(true);
      const filters = `${added} new filter${added === 1 ? '' : 's'}`;
      const skipped = blocktube.data.skipped.length
        ? ` Skipped: ${blocktube.data.skipped.join(', ')}.`
        : '';
      setStatus('import-status', `Imported ${filters} from a BlockTube backup.${skipped}`, true);
      return;
    }

    if (isBlockerState(parsed)) {
      setDraft(normalizeState(parsed));
      notify();
      setDirty(true);
      setStatus('import-status', 'Imported YouTubeMyTube settings.', true);
      return;
    }

    setStatus('import-status', 'That file is not a YouTubeMyTube or BlockTube backup.', false);
  };
  reader.readAsText(file);
}
