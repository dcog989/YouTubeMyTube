import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importSettings } from '../src/options/data';
import { defaultState } from '../src/shared/defaults';

const mocks = vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = { addEventListener: () => {} };
  return {
    setStatus: vi.fn(),
    setDraft: vi.fn(),
    setDirty: vi.fn(),
    notify: vi.fn(),
    backfillMissing: vi.fn(() => Promise.resolve()),
    state: { draft: undefined as unknown, dirty: false },
  };
});

vi.mock('../src/options/dom', () => ({ setStatus: mocks.setStatus }));
vi.mock('../src/options/backfill', () => ({ backfillMissing: mocks.backfillMissing }));
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
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);

    await importSettings(fileOf(JSON.stringify(NATIVE)));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(mocks.setDraft).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
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
