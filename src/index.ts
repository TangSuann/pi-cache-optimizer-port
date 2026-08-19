import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { loadConfig } from "./config.js";
import { normalizeUsageSnapshot } from "./usage.js";
import { createStatsStore, formatStatsText, modelKey } from "./stats.js";

export default definePluginEntry({
  id: "pi-cache-optimizer-port",
  name: "Pi Cache Optimizer Port",
  description:
    "Phase one: persists normalized per-provider/model prompt-cache statistics " +
    "from llm_output and exposes them via /cache-optimizer-stats.",
  register(api) {
    const cfg = loadConfig(api.pluginConfig);
    if (!cfg.enabled) {
      api.logger?.debug?.("[pi-cache-optimizer-port] disabled by config");
      return;
    }

    const store = createStatsStore({
      statsPath: cfg.statsPath,
      debounceMs: cfg.debounceMs,
    });
    void store.load();

    api.on(
      "llm_output",
      (event) => {
        if (!cfg.collectStats) return;
        const usage = normalizeUsageSnapshot(event.usage);
        if (!usage) return;
        store.record(modelKey(event.provider, event.model), usage);
      },
      { priority: 50 },
    );

    api.on("gateway_stop", () => {
      void store.flush();
    });

    api.registerCommand({
      name: "cache-optimizer-stats",
      description:
        "Show persisted per-model prompt-cache statistics (hit requests, cached/total input tokens).",
      acceptsArgs: false,
      requireAuth: true,
      handler: () => {
        return { text: formatStatsText(store.snapshot()), suppressReply: false };
      },
    });
  },
});
