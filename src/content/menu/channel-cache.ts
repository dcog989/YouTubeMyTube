import { type ChannelMeta, resolveVideoChannel } from '../../shared/resolve';
import type { Entity } from '../../shared/types';

export interface ChannelCache {
  get(videoId: string): ChannelMeta | undefined;
  request(videoId: string): Promise<void> | null;
}

// Fill a card's missing channel identity from a lookup that already resolved.
export function withCachedChannel(cache: ChannelCache, entity: Entity): Entity {
  if (!entity.videoId || entity.channelId || entity.handle) return entity;
  const meta = cache.get(entity.videoId);
  if (!meta) return entity;
  if (meta.id) entity.channelId = meta.id;
  if (meta.handle) entity.handle = meta.handle;
  if (meta.name) entity.channelName = meta.name;
  return entity;
}

const MAX_ENTRIES = 100;
const MAX_QUEUED_LOOKUPS = 100;
const EMPTY_TTL_MS = 60_000;
// A feed can show dozens of Shorts at once; cap the burst so YouTube does not
// rate-limit the whole batch and leave those cards unresolved.
const MAX_CONCURRENT_LOOKUPS = 4;

export function createChannelCache(): ChannelCache {
  const cache = new Map<string, ChannelMeta>();
  const pending = new Map<string, Promise<void>>();
  const retryAfter = new Map<string, number>();
  let active = 0;
  const queue: Array<() => void> = [];

  function startOrQueue(task: () => void): void {
    if (active < MAX_CONCURRENT_LOOKUPS) {
      active += 1;
      task();
      return;
    }
    queue.push(task);
  }

  function finishLookup(): void {
    const next = queue.shift();
    if (next) {
      next();
      return;
    }
    active -= 1;
  }

  function evictExcess<K, V>(map: Map<K, V>): void {
    if (map.size <= MAX_ENTRIES) return;
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }

  function store(videoId: string, meta: ChannelMeta): void {
    retryAfter.delete(videoId);
    cache.delete(videoId);
    cache.set(videoId, meta);
    evictExcess(cache);
  }

  function markEmpty(videoId: string): void {
    retryAfter.delete(videoId);
    retryAfter.set(videoId, Date.now() + EMPTY_TTL_MS);
    evictExcess(retryAfter);
  }

  function isBackedOff(videoId: string): boolean {
    const until = retryAfter.get(videoId);
    if (until === undefined) return false;
    if (until > Date.now()) return true;
    retryAfter.delete(videoId);
    return false;
  }

  return {
    get(videoId) {
      const meta = cache.get(videoId);
      if (meta) store(videoId, meta);
      return meta;
    },
    request(videoId) {
      if (cache.has(videoId) || isBackedOff(videoId)) return null;
      // Cards the user already scrolled past would otherwise pile up as queued
      // requests that fire minutes later.
      if (active >= MAX_CONCURRENT_LOOKUPS && queue.length >= MAX_QUEUED_LOOKUPS) return null;
      const inFlight = pending.get(videoId);
      if (inFlight) return inFlight;

      const promise = new Promise<void>((resolve) => {
        startOrQueue(() => {
          resolveVideoChannel(videoId)
            .then((meta) => {
              if (meta.id || meta.handle || meta.name) store(videoId, meta);
              else markEmpty(videoId);
            })
            .catch(() => {
              markEmpty(videoId);
            })
            .finally(() => {
              pending.delete(videoId);
              resolve();
              finishLookup();
            });
        });
      });

      pending.set(videoId, promise);
      return promise;
    },
  };
}
