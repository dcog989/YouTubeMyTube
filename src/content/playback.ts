function pauseVideo(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLVideoElement) target.pause();
}

function pauseAll(): void {
  document.querySelectorAll('video').forEach((video) => {
    video.pause();
  });
}

export interface PlaybackLease {
  release(): void;
}

export interface PlaybackGuard {
  // Ref-counted: the capture `play` listener and pause-all engage on the first
  // lease and disengage when the last lease is released, so overlapping holders
  // (blank cover + channel overlay) coexist.
  acquire(): PlaybackLease;
}

export function createPlaybackGuard(): PlaybackGuard {
  let active = 0;
  let engaged = false;

  function engage(): void {
    if (engaged) return;
    engaged = true;
    document.addEventListener('play', pauseVideo, true);
    pauseAll();
  }

  function disengage(): void {
    if (!engaged) return;
    engaged = false;
    document.removeEventListener('play', pauseVideo, true);
  }

  return {
    acquire(): PlaybackLease {
      active += 1;
      engage();
      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          active -= 1;
          if (active === 0) disengage();
        },
      };
    },
  };
}
