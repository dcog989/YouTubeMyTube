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
  const leases = new Set<PlaybackLease>();
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
      let released = false;
      const lease: PlaybackLease = {
        release() {
          if (released) return;
          released = true;
          leases.delete(lease);
          if (leases.size === 0) disengage();
        },
      };
      leases.add(lease);
      engage();
      return lease;
    },
  };
}
