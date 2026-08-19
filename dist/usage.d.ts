export type NormalizedUsage = {
    cacheRead: number;
    cacheWrite: number;
    totalInput: number;
};
/**
 * Normalize a provider-specific usage shape into a provider-agnostic snapshot.
 *
 * Resolution order mirrors pi-cache-optimizer:
 *   1. Already-normalized cacheRead/cacheWrite (input is the uncached portion).
 *   2. DeepSeek native prompt_cache_hit_tokens / prompt_cache_miss_tokens.
 *   3. OpenAI native prompt_tokens_details.cached_tokens / cache_write_tokens.
 *   4. Anthropic native cache_read_input_tokens / cache_creation_input_tokens.
 */
export declare function normalizeUsageSnapshot(raw: unknown): NormalizedUsage | undefined;
