import { describe, expect, it } from 'vitest';
import { mergeBlockTubeImport, parseBlockTubeBackup } from '../src/shared/blocktube';
import { defaultState } from '../src/shared/storage';

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
      videoId: ['vid1', 'vid2'],
      channelId: ['UC1'],
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
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.videoIds).toEqual(['vid1', 'vid2']);
    expect(result.data.channelIds).toEqual(['UC1']);
    expect(result.data.channelFilters).toEqual(['drama']);
    expect(result.data.titleFilters).toEqual(['spoiler']);
    expect(result.data.commentFilters).toEqual(['free crypto']);
    expect(result.data.skipped).toEqual([]);
  });

  it('drops comment, blank and non-string entries', () => {
    const result = parseBlockTubeBackup(backup({ videoId: ['a', '// comment', '', 3, 'a'] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.videoIds).toEqual(['a']);
  });

  it('maps supported options', () => {
    const result = parseBlockTubeBackup(
      backup({}, { trending: true, shorts: true, block_message: ' Blocked! ' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.areas.trendingPage).toBe(true);
    expect(result.data.areas.shortsPage).toBe(true);
    expect(result.data.areas.shortsShelf).toBe(true);
    expect(result.data.blockMessage).toBe('Blocked!');
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
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skipped).toEqual(
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
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skipped).toContain('options password');
  });

  it('rejects files that are not BlockTube backups', () => {
    expect(parseBlockTubeBackup(null).ok).toBe(false);
    expect(parseBlockTubeBackup({ state: {} }).ok).toBe(false);
    expect(parseBlockTubeBackup({ filterData: {} }).ok).toBe(false);
  });
});

describe('mergeBlockTubeImport', () => {
  it('adds new entries and skips duplicates', () => {
    const state = defaultState();
    state.rules.videos = [{ id: 'vid1', title: '' }];
    const parsed = parseBlockTubeBackup(backup());
    if (!parsed.ok) throw new Error('expected parse success');

    const { state: merged, added } = mergeBlockTubeImport(state, parsed.data);
    expect(added).toBe(5);
    expect(merged.rules.videos.map((video) => video.id)).toEqual(['vid1', 'vid2']);
    expect(merged.rules.channels.map((channel) => channel.id)).toEqual(['UC1']);
    expect(merged.rules.channelFilters).toEqual(['drama']);
    expect(merged.rules.titleFilters).toEqual(['spoiler']);
    expect(merged.rules.commentFilters).toEqual(['free crypto']);
    expect(state.rules.videos).toEqual([{ id: 'vid1', title: '' }]);
  });

  it('enables imported areas without disabling existing ones', () => {
    const state = defaultState();
    state.areas.relatedVideos = true;
    const parsed = parseBlockTubeBackup(backup({}, { trending: true, shorts: true }));
    if (!parsed.ok) throw new Error('expected parse success');

    const { state: merged } = mergeBlockTubeImport(state, parsed.data);
    expect(merged.areas.trendingPage).toBe(true);
    expect(merged.areas.shortsPage).toBe(true);
    expect(merged.areas.relatedVideos).toBe(true);
  });

  it('applies an imported block message when present', () => {
    const parsed = parseBlockTubeBackup(backup({}, { block_message: 'Go away' }));
    if (!parsed.ok) throw new Error('expected parse success');

    const { state: merged } = mergeBlockTubeImport(defaultState(), parsed.data);
    expect(merged.settings.blockMessage).toBe('Go away');
  });
});
