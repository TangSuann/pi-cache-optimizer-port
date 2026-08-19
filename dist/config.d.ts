export type PluginConfig = {
    enabled: boolean;
    reorder: boolean;
    stripSessionOverview: boolean;
    compressSkills: boolean;
    collectStats: boolean;
    statsPath: string;
    debounceMs: number;
};
export declare const DEFAULT_CONFIG: PluginConfig;
export declare function loadConfig(pluginConfig?: Record<string, unknown>): PluginConfig;
