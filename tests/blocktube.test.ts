import { describe, expect, it } from 'vitest';
import { mergeBlockTubeImport, parseBlockTubeBackup } from '../src/shared/blocktube';
import { defaultState } from '../src/shared/defaults';

const VIDEO_A = 'vid00000001';
const VIDEO_B = 'vid00000002';
const CHANNEL = `UC${'a'.repeat(22)}`;

const DEFAULT_JS = `(video, objectType) => {
  // Add custom conditions below

  // Custom conditions did not match, do not block
  return false;
}`;

function backup(
  overrides: Record<string, unknown> = {},
  optionOverrides: Record<string, unknown> = {},
) {
  return {
    filterData: {
      videoId: [VIDEO_A, VIDEO_B],
      channelId: [CHANNEL],
      channelName: ['drama'],
      title: ['spoiler'],
      comment: ['free crypto'],
      vidLength: [Number.NaN, Number.NaN],
      javascript: DEFAULT_JS,
      ...overrides,
    },
    options: { trending: false, shorts: false, block_message: '', ...optionOverrides },
    uiPass: '',
    uiTheme: 'light',
  };
}

describe('parseBlockTubeBackup', () => {
  it('maps BlockTube filter lists', () => {
    const result = parseBlockTubeBackup(backup());
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.videoIds).toEqual([VIDEO_A, VIDEO_B]);
    expect(result.channelIds).toEqual([CHANNEL]);
    expect(result.channelRefs).toEqual([]);
    expect(result.channelNameFilters).toEqual(['drama']);
    expect(result.titleFilters).toEqual(['spoiler']);
    expect(result.commentFilters).toEqual(['free crypto']);
    expect(result.skipped).toEqual([]);
  });

  it('splits handles, labels and trailing handles into channel rows', () => {
    const result = parseBlockTubeBackup(
      backup({ channelName: ['@SomeHandle', 'drama', '@', '7NEWS Australia   @7news'] }),
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.channelRefs).toEqual([
      { name: '', handle: 'somehandle' },
      { name: '7NEWS Australia', handle: '7news' },
    ]);
    expect(result.channelNameFilters).toEqual(['drama', '@']);
  });

  it('drops comment, blank and non-string entries', () => {
    const result = parseBlockTubeBackup(
      backup({ videoId: [VIDEO_A, '// comment', '', 3, VIDEO_A] }),
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.videoIds).toEqual([VIDEO_A]);
    expect(result.skipped).toContain('invalid video IDs');
  });

  it('drops ids that cannot match a video or channel', () => {
    const result = parseBlockTubeBackup(
      backup({ videoId: ['watch?v=abcdefghijk'], channelId: ['nope'] }),
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.videoIds).toEqual([]);
    expect(result.channelIds).toEqual([]);
    expect(result.skipped).toEqual(
      expect.arrayContaining(['invalid video IDs', 'invalid channel IDs']),
    );
  });

  it('maps supported options', () => {
    const result = parseBlockTubeBackup(
      backup({}, { trending: true, shorts: true, block_message: ' Blocked! ' }),
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.areas.trendingPage).toBe(true);
    expect(result.areas.shortsPage).toBe(true);
    expect(result.areas.shortsShelf).toBe(true);
    expect(result.skipped).toContain('block message');
  });

  it('reports unsupported fields instead of failing', () => {
    const result = parseBlockTubeBackup(
      backup(
        {
          javascript: 'return video.title === "x";',
          vidLength: [10, 60],
        },
        { autoplay: true, mixes: true, percent_watched_hide: 90 },
      ),
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        'advanced JavaScript blocking',
        'video length filters',
        'autoplay blocking',
        'mix blocking',
        'watched-percentage hiding',
      ]),
    );
  });

  it('notes a configured options password', () => {
    const result = parseBlockTubeBackup({ ...backup(), uiPass: 'secret' });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.skipped).toContain('options password');
  });

  it('rejects files that are not BlockTube backups', () => {
    expect(parseBlockTubeBackup(null)).toBeNull();
    expect(parseBlockTubeBackup({ state: {} })).toBeNull();
    expect(parseBlockTubeBackup({ filterData: {} })).toBeNull();
    expect(parseBlockTubeBackup({ filterData: [], options: [] })).toBeNull();
    expect(parseBlockTubeBackup({ filterData: { videoId: 'x' }, options: {} })).toBeNull();
  });
});

describe('mergeBlockTubeImport', () => {
  it('adds new entries and skips duplicates', () => {
    const state = defaultState();
    state.rules.videos = [{ id: VIDEO_A, title: '' }];
    const parsed = parseBlockTubeBackup(backup());
    if (!parsed) throw new Error('expected parse success');

    const { state: merged, added } = mergeBlockTubeImport(state, parsed);
    expect(added).toBe(5);
    expect(merged.rules.videos.map((video) => video.id)).toEqual([VIDEO_A, VIDEO_B]);
    expect(merged.rules.channels).toEqual([{ id: CHANNEL, name: '', handle: '' }]);
    expect(merged.rules.channelFilters).toEqual(['drama']);
    expect(merged.rules.titleFilters).toEqual(['spoiler']);
    expect(merged.rules.commentFilters).toEqual(['free crypto']);
    expect(state.rules.videos).toEqual([{ id: VIDEO_A, title: '' }]);
  });

  it('adds channel handles and names as channel rows', () => {
    const state = defaultState();
    const parsed = parseBlockTubeBackup(
      backup({ channelName: ['@SomeHandle', 'drama', '7NEWS Australia   @7news'] }),
    );
    if (!parsed) throw new Error('expected parse success');

    const { state: merged, added } = mergeBlockTubeImport(state, parsed);
    expect(added).toBe(8);
    expect(merged.rules.channels).toEqual([
      { id: CHANNEL, name: '', handle: '' },
      { id: '', name: '', handle: 'somehandle' },
      { id: '', name: '7NEWS Australia', handle: '7news' },
    ]);
    expect(merged.rules.channelFilters).toEqual(['drama']);
  });

  it('enables imported areas without disabling existing ones', () => {
    const state = defaultState();
    state.areas.relatedVideos = true;
    const parsed = parseBlockTubeBackup(backup({}, { trending: true, shorts: true }));
    if (!parsed) throw new Error('expected parse success');

    const { state: merged } = mergeBlockTubeImport(state, parsed);
    expect(merged.areas.trendingPage).toBe(true);
    expect(merged.areas.shortsPage).toBe(true);
    expect(merged.areas.relatedVideos).toBe(true);
  });

  it('reports an imported block message as unsupported', () => {
    const parsed = parseBlockTubeBackup(backup({}, { block_message: 'Go away' }));
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed.skipped).toContain('block message');
  });
});
