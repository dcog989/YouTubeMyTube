const YOUTUBE_ORIGINS = [
  'https://www.youtube.com/*',
  'https://m.youtube.com/*',
  'https://music.youtube.com/*',
];

// Host access is optional in Firefox MV3: a temporary load or a reinstall can
// leave the extension without it, and content scripts then silently never run.
// A browser that cannot answer is treated as granted, so the warning does not
// become noise where the API is unavailable.
export async function hasYouTubeAccess(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: YOUTUBE_ORIGINS });
  } catch {
    return true;
  }
}
