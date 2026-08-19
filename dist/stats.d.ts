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
export declare function addUsageToStats(stats: CacheStats, usage: NormalizedUsage): void;
export declare function modelKey(provider: string, model: string): string;
export declare function formatTokenCount(value: number): string;
export declare function formatStatsLine(key: string, stats: CacheStats): string;
export declare function formatStatsText(totalsByModel: Record<string, CacheStats>): string;
export type StatsStoreOptions = {
    statsPath: string;
    debounceMs: number;
};
export declare function createStatsStore(opts: StatsStoreOptions): {
    load: () => Promise<void>;
    record: (key: string, usage: NormalizedUsage) => void;
    flush: () => Promise<void>;
    reset: () => Promise<void>;
    snapshot: () => Record<string, CacheStats>;
    getStats: (key: string) => CacheStats;
};
