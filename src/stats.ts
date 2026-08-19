import {
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import type { NormalizedUsage } from "./usage.js";

export type CacheStats = {
  totalRequests: number;
  hitRequests: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  totalInputTokens: number;
};

export type PersistedCacheStats = {
  version: 1;
  day: string;
  totalsByModel: Record<string, CacheStats>;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyStats(): CacheStats {
  return {
    totalRequests: 0,
    hitRequests: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    totalInputTokens: 0,
  };
}

export function addUsageToStats(
  stats: CacheStats,
  usage: NormalizedUsage,
): void {
  stats.totalRequests += 1;
  if (usage.cacheRead > 0) stats.hitRequests += 1;
  stats.cachedInputTokens += usage.cacheRead;
  stats.cacheWriteInputTokens += usage.cacheWrite;
  stats.totalInputTokens += usage.totalInput;
}

export function modelKey(provider: string, model: string): string {
  const p = (provider ?? "").trim();
  const m = (model ?? "").trim();
  if (!p) return m || "unknown";
  if (!m) return p;
  return `${p}/${m}`;
}

export function formatTokenCount(value: number): string {
  const millions = Math.max(0, Math.round(value)) / 1_000_000;
  if (millions === 0) return "0M";
  if (millions < 0.001) return `${millions.toFixed(4)}M`;
  if (millions < 0.01) return `${millions.toFixed(3)}M`;
  if (millions >= 10) return `${millions.toFixed(1)}M`;
  return `${millions.toFixed(2)}M`;
}

export function formatStatsLine(key: string, stats: CacheStats): string {
  const percent =
    stats.totalInputTokens > 0
      ? (stats.cachedInputTokens / stats.totalInputTokens) * 100
      : 0;
  const writeText =
    stats.cacheWriteInputTokens > 0
      ? ` · write ${formatTokenCount(stats.cacheWriteInputTokens)}`
      : "";
  return (
    `${key} Requests: ${stats.hitRequests}/${stats.totalRequests} hit · ` +
    `tokens ${formatTokenCount(stats.cachedInputTokens)}/${formatTokenCount(stats.totalInputTokens)} · ` +
    `${percent.toFixed(1)}%${writeText}`
  );
}

export function formatStatsText(totalsByModel: Record<string, CacheStats>): string {
  const keys = Object.keys(totalsByModel).sort();
  if (keys.length === 0) return "No cache stats recorded yet.";
  return keys.map((key) => formatStatsLine(key, totalsByModel[key])).join("\n");
}

export type StatsStoreOptions = {
  statsPath: string;
  debounceMs: number;
};

const LOCK_TIMEOUT_MS = 5000;
const LOCK_POLL_MS = 25;
const LOCK_STALE_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneStats(stats: CacheStats): CacheStats {
  return { ...stats };
}

function cloneTotals(totals: Record<string, CacheStats>): Record<string, CacheStats> {
  const result: Record<string, CacheStats> = {};
  for (const [key, stats] of Object.entries(totals)) {
    result[key] = cloneStats(stats);
  }
  return result;
}

function addInto(target: CacheStats, delta: CacheStats): void {
  target.totalRequests += delta.totalRequests;
  target.hitRequests += delta.hitRequests;
  target.cachedInputTokens += delta.cachedInputTokens;
  target.cacheWriteInputTokens += delta.cacheWriteInputTokens;
  target.totalInputTokens += delta.totalInputTokens;
}

async function readPersistedStats(
  statsPath: string,
): Promise<PersistedCacheStats | null> {
  try {
    const text = await readFile(statsPath, "utf8");
    const parsed = JSON.parse(text) as Partial<PersistedCacheStats>;
    if (
      parsed?.version === 1 &&
      typeof parsed.day === "string" &&
      parsed.totalsByModel &&
      typeof parsed.totalsByModel === "object"
    ) {
      return {
        version: 1,
        day: parsed.day,
        totalsByModel: parsed.totalsByModel as Record<string, CacheStats>,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function writePersistedStats(
  statsPath: string,
  payload: PersistedCacheStats,
): Promise<void> {
  await mkdir(dirname(statsPath), { recursive: true });
  const tmpPath = `${statsPath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf8");
  await rename(tmpPath, statsPath);
}

/**
 * Acquire an exclusive lock file so concurrent writers serialize their
 * read-modify-write cycle. Returns a release function; a no-op release is
 * returned when locking is unavailable (e.g. read-only filesystem), so stats
 * persistence still degrades gracefully instead of throwing into the hook
 * pipeline.
 */
async function acquireLock(lockPath: string): Promise<() => Promise<void>> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${process.pid} ${Date.now()}\n`, "utf8").catch(() => {});
      await handle.close();
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await unlink(lockPath).catch(() => {});
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        // Locking is not supported here; continue without coordination.
        return async () => {};
      }
      if (Date.now() >= deadline) {
        // Recover from a lock left behind by a crashed writer.
        try {
          const lockStat = await stat(lockPath);
          if (Date.now() - lockStat.mtimeMs > LOCK_STALE_MS) {
            await unlink(lockPath).catch(() => {});
            continue;
          }
        } catch {
          // The lock vanished between attempts; retry acquisition.
          continue;
        }
        // A fresh lock is still held by someone else; give up and continue.
        return async () => {};
      }
      await sleep(LOCK_POLL_MS);
    }
  }
}

export function createStatsStore(opts: StatsStoreOptions) {
  let totalsByModel: Record<string, CacheStats> = {};
  let pending: Record<string, CacheStats> = {};
  let day = today();
  let timer: NodeJS.Timeout | undefined;
  let loaded = false;

  function maybeRollOver(): void {
    const current = today();
    if (current !== day) {
      day = current;
      totalsByModel = {};
      pending = {};
    }
  }

  async function persist(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    const dir = dirname(opts.statsPath);
    await mkdir(dir, { recursive: true });
    const release = await acquireLock(`${opts.statsPath}.lock`);
    try {
      const onDisk = await readPersistedStats(opts.statsPath);
      const totals =
        onDisk && onDisk.day === day
          ? cloneTotals(onDisk.totalsByModel)
          : {};
      for (const [key, delta] of Object.entries(pending)) {
        const target = totals[key] ?? emptyStats();
        addInto(target, delta);
        totals[key] = target;
      }
      await writePersistedStats(opts.statsPath, {
        version: 1,
        day,
        totalsByModel: totals,
      });
      pending = {};
    } catch {
      // Stats persistence must never throw into the hook pipeline.
    } finally {
      await release();
    }
  }

  function schedulePersist(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void persist();
    }, opts.debounceMs);
    if (typeof timer.unref === "function") timer.unref();
  }

  async function load(): Promise<void> {
    if (loaded) return;
    loaded = true;
    const onDisk = await readPersistedStats(opts.statsPath);
    if (onDisk && onDisk.day === day) {
      // Merge (not overwrite) so any records that arrived while the read was
      // in-flight are preserved in the in-memory snapshot.
      const merged = cloneTotals(onDisk.totalsByModel);
      for (const [key, stats] of Object.entries(totalsByModel)) {
        const target = merged[key] ?? emptyStats();
        addInto(target, stats);
        merged[key] = target;
      }
      totalsByModel = merged;
    }
  }

  function getStats(key: string): CacheStats {
    const existing = totalsByModel[key];
    if (existing) return existing;
    const stats = emptyStats();
    totalsByModel[key] = stats;
    return stats;
  }

  function getPendingStats(key: string): CacheStats {
    const existing = pending[key];
    if (existing) return existing;
    const stats = emptyStats();
    pending[key] = stats;
    return stats;
  }

  function record(key: string, usage: NormalizedUsage): void {
    maybeRollOver();
    addUsageToStats(getStats(key), usage);
    addUsageToStats(getPendingStats(key), usage);
    schedulePersist();
  }

  function snapshot(): Record<string, CacheStats> {
    return cloneTotals(totalsByModel);
  }

  async function flush(): Promise<void> {
    await persist();
  }

  async function reset(): Promise<void> {
    totalsByModel = {};
    pending = {};
    day = today();
    await persist();
  }

  return { load, record, flush, reset, snapshot, getStats };
}
