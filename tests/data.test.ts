import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importSettings, restoreBackup } from '../src/options/data';
import { defaultState } from '../src/shared/defaults';

const mocks = vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = { addEventListener: () => {} };
  return {
    setStatus: vi.fn(),
    setDraft: vi.fn(),
    setDirty: vi.fn(),
    notify: vi.fn(),
    backfillMissing: vi.fn(() => Promise.resolve()),
    readBackup: vi.fn(),
    confirmAction: vi.fn(() => Promise.resolve(true)),
    state: { draft: undefined as unknown, dirty: false },
  };
});

vi.mock('../src/options/dom', () => ({ setStatus: mocks.setStatus }));
vi.mock('../src/options/backfill', () => ({ backfillMissing: mocks.backfillMissing }));
vi.mock('../src/shared/backup', () => ({ readBackup: mocks.readBackup }));
vi.mock('../src/options/confirm', () => ({ confirmAction: mocks.confirmAction }));
vi.mock('../src/options/state', () => ({
  getDraft: () => mocks.state.draft,
  setDraft: mocks.setDraft,
  setDirty: mocks.setDirty,
  notify: mocks.notify,
  isDirty: () => mocks.state.dirty,
}));

function fileOf(content: string, size = content.length): File {
  return { text: async () => content, size } as File;
}

const NATIVE = {
  rules: { channels: [], videos: [], channelFilters: [], titleFilters: [], commentFilters: [] },
  areas: {},
  settings: {},
};

describe('importSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.draft = defaultState();
    mocks.state.dirty = false;
  });

  it('imports a native export that predates a newer rule list', async () => {
    const legacy = { rules: { channels: [{ id: '', name: 'Music', handle: '' }], videos: [] } };

    await importSettings(fileOf(JSON.stringify(legacy)));

    expect(mocks.setDraft).toHaveBeenCalledTimes(1);
    expect(mocks.setDirty).toHaveBeenCalledWith(true);
    expect(mocks.backfillMissing).toHaveBeenCalledTimes(1);
  });

  it('rejects a file above the size cap before reading it', async () => {
    await importSettings(fileOf('{}', 6 * 1024 * 1024));

    expect(mocks.setStatus).toHaveBeenCalledWith('import-status', expect.any(String), false);
    expect(mocks.setDraft).not.toHaveBeenCalled();
  });

  it('asks before replacing unsaved changes with a native import', async () => {
    mocks.state.dirty = true;
    mocks.confirmAction.mockResolvedValueOnce(false);

    await importSettings(fileOf(JSON.stringify(NATIVE)));

    expect(mocks.confirmAction).toHaveBeenCalledTimes(1);
    expect(mocks.setDraft).not.toHaveBeenCalled();
  });

  it('merges a BlockTube backup into the draft without asking', async () => {
    const backup = { filterData: { videoId: ['dQw4w9WgXcQ'] }, options: {} };

    await importSettings(fileOf(JSON.stringify(backup)));

    expect(mocks.setDraft).toHaveBeenCalledTimes(1);
    expect(mocks.setDraft.mock.calls[0]?.[0].rules.videos).toEqual([
      { id: 'dQw4w9WgXcQ', title: '' },
    ]);
  });

  it('reports invalid JSON', async () => {
    await importSettings(fileOf('not json'));

    expect(mocks.setStatus).toHaveBeenCalledWith('import-status', expect.any(String), false);
    expect(mocks.setDraft).not.toHaveBeenCalled();
  });
});

describe('restoreBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.draft = defaultState();
    mocks.state.dirty = false;
    mocks.readBackup.mockResolvedValue(undefined);
  });

  it('loads the snapshot into the draft without saving', async () => {
    const saved = defaultState();
    saved.rules.videos = [{ id: 'dQw4w9WgXcQ', title: '' }];
    mocks.readBackup.mockResolvedValue({ state: saved, savedAt: 1 });

    await restoreBackup();

    expect(mocks.setDraft).toHaveBeenCalledWith(saved);
    expect(mocks.setDirty).toHaveBeenCalledWith(true);
    expect(mocks.setStatus).toHaveBeenCalledWith('import-status', expect.any(String), true);
  });

  it('reports an empty or missing backup instead of restoring defaults', async () => {
    await restoreBackup();
    expect(mocks.setDraft).not.toHaveBeenCalled();

    mocks.readBackup.mockResolvedValue({ state: defaultState(), savedAt: 1 });
    await restoreBackup();
    expect(mocks.setDraft).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenLastCalledWith('import-status', expect.any(String), false);
  });

  it('asks before replacing unsaved changes', async () => {
    const saved = defaultState();
    saved.rules.videos = [{ id: 'dQw4w9WgXcQ', title: '' }];
    mocks.readBackup.mockResolvedValue({ state: saved, savedAt: 1 });
    mocks.state.dirty = true;
    mocks.confirmAction.mockResolvedValueOnce(false);

    await restoreBackup();

    expect(mocks.confirmAction).toHaveBeenCalledTimes(1);
    expect(mocks.setDraft).not.toHaveBeenCalled();
  });
});
