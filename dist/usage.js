function getNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return undefined;
}
function getNonNegativeNumber(value) {
    const number = getNumber(value);
    if (number !== undefined && number >= 0)
        return number;
    return undefined;
}
function getFirstNonNegativeNumber(...values) {
    for (const value of values) {
        const number = getNonNegativeNumber(value);
        if (number !== undefined)
            return number;
    }
    return undefined;
}
function asRecord(value) {
    return typeof value === "object" && value !== null
        ? value
        : undefined;
}
function getNestedRecord(record, key) {
    return asRecord(record?.[key]);
}
function readCachedTokensFromDetails(details) {
    return getFirstNonNegativeNumber(details?.cached_tokens, details?.cachedTokens);
}
function readCacheWriteFromDetails(details) {
    return getFirstNonNegativeNumber(details?.cache_write_tokens, details?.cacheWriteTokens);
}
/**
 * Normalize a provider-specific usage shape into a provider-agnostic snapshot.
 *
 * Resolution order mirrors pi-cache-optimizer:
 *   1. Already-normalized cacheRead/cacheWrite (input is the uncached portion).
 *   2. DeepSeek native prompt_cache_hit_tokens / prompt_cache_miss_tokens.
 *   3. OpenAI native prompt_tokens_details.cached_tokens / cache_write_tokens.
 *   4. Anthropic native cache_read_input_tokens / cache_creation_input_tokens.
 */
export function normalizeUsageSnapshot(raw) {
    const record = asRecord(raw);
    if (!record)
        return undefined;
    return (getNormalizedUsage(record) ??
        getDeepSeekRawUsage(record) ??
        getOpenAIRawUsage(record) ??
        getAnthropicRawUsage(record));
}
function getNormalizedUsage(usage) {
    const input = getNonNegativeNumber(usage.input);
    const cacheRead = getNonNegativeNumber(usage.cacheRead);
    const cacheWrite = getNonNegativeNumber(usage.cacheWrite);
    const hasCacheSignal = cacheRead !== undefined || cacheWrite !== undefined;
    if (!hasCacheSignal && input === undefined)
        return undefined;
    const computed = (input ?? 0) + (cacheRead ?? 0) + (cacheWrite ?? 0);
    const floor = (cacheRead ?? 0) + (cacheWrite ?? 0);
    return {
        cacheRead: cacheRead ?? 0,
        cacheWrite: cacheWrite ?? 0,
        totalInput: computed >= floor ? computed : floor,
    };
}
function getDeepSeekRawUsage(usage) {
    const cacheRead = getFirstNonNegativeNumber(usage.prompt_cache_hit_tokens);
    if (cacheRead === undefined)
        return undefined;
    const cacheMiss = getFirstNonNegativeNumber(usage.prompt_cache_miss_tokens);
    const promptTokens = getFirstNonNegativeNumber(usage.prompt_tokens, usage.promptTokens);
    // DeepSeek guarantees prompt_tokens = hit + miss.
    const totalInput = promptTokens ?? cacheRead + (cacheMiss ?? 0);
    return { cacheRead, cacheWrite: 0, totalInput };
}
function getOpenAIRawUsage(usage) {
    const promptDetails = getNestedRecord(usage, "prompt_tokens_details") ??
        getNestedRecord(usage, "promptTokensDetails");
    const inputDetails = getNestedRecord(usage, "input_tokens_details") ??
        getNestedRecord(usage, "inputTokensDetails");
    const cacheRead = readCachedTokensFromDetails(promptDetails) ??
        readCachedTokensFromDetails(inputDetails);
    if (cacheRead === undefined)
        return undefined;
    const cacheWrite = readCacheWriteFromDetails(promptDetails) ??
        readCacheWriteFromDetails(inputDetails) ??
        0;
    const totalInput = getFirstNonNegativeNumber(usage.prompt_tokens, usage.promptTokens, usage.input_tokens, usage.inputTokens) ?? cacheRead + cacheWrite;
    return { cacheRead, cacheWrite, totalInput };
}
function getAnthropicRawUsage(usage) {
    const cacheRead = getFirstNonNegativeNumber(usage.cache_read_input_tokens, usage.cacheReadInputTokens);
    const cacheWrite = getFirstNonNegativeNumber(usage.cache_creation_input_tokens, usage.cacheCreationInputTokens);
    if (cacheRead === undefined && cacheWrite === undefined)
        return undefined;
    // Anthropic input_tokens = tokens after the last cache breakpoint.
    const input = getFirstNonNegativeNumber(usage.input_tokens, usage.inputTokens) ?? 0;
    return {
        cacheRead: cacheRead ?? 0,
        cacheWrite: cacheWrite ?? 0,
        totalInput: input + (cacheRead ?? 0) + (cacheWrite ?? 0),
    };
}
