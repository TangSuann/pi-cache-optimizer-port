import { homedir } from "node:os";
import { join } from "node:path";
export const DEFAULT_CONFIG = {
    enabled: true,
    reorder: true,
    stripSessionOverview: true,
    compressSkills: true,
    collectStats: true,
    statsPath: join(homedir(), ".openclaw", "pi-cache-optimizer-stats.json"),
    debounceMs: 2000,
};
export function loadConfig(pluginConfig) {
    const cfg = pluginConfig ?? {};
    return {
        ...DEFAULT_CONFIG,
        ...(typeof cfg.enabled === "boolean" ? { enabled: cfg.enabled } : {}),
        ...(typeof cfg.reorder === "boolean" ? { reorder: cfg.reorder } : {}),
        ...(typeof cfg.stripSessionOverview === "boolean"
            ? { stripSessionOverview: cfg.stripSessionOverview }
            : {}),
        ...(typeof cfg.compressSkills === "boolean"
            ? { compressSkills: cfg.compressSkills }
            : {}),
        ...(typeof cfg.collectStats === "boolean"
            ? { collectStats: cfg.collectStats }
            : {}),
        ...(typeof cfg.statsPath === "string" && cfg.statsPath.length > 0
            ? { statsPath: cfg.statsPath }
            : {}),
        ...(typeof cfg.debounceMs === "number" &&
            Number.isFinite(cfg.debounceMs) &&
            cfg.debounceMs >= 0
            ? { debounceMs: cfg.debounceMs }
            : {}),
    };
}
