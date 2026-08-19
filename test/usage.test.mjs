import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUsageSnapshot } from "../dist/usage.js";

test("DeepSeek raw fields map cacheRead and totalInput", () => {
  const snapshot = normalizeUsageSnapshot({
    prompt_cache_hit_tokens: 320,
    prompt_cache_miss_tokens: 96,
    prompt_tokens: 416,
    completion_tokens: 50,
  });
  assert.deepEqual(snapshot, { cacheRead: 320, cacheWrite: 0, totalInput: 416 });
});

test("DeepSeek cache miss still derives totalInput from hit + miss", () => {
  const snapshot = normalizeUsageSnapshot({
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 128,
  });
  assert.deepEqual(snapshot, { cacheRead: 0, cacheWrite: 0, totalInput: 128 });
});

test("normalized cacheRead/cacheWrite wins over raw DeepSeek fields", () => {
  const snapshot = normalizeUsageSnapshot({
    input: 96,
    cacheRead: 320,
    cacheWrite: 0,
    prompt_cache_hit_tokens: 999,
  });
  assert.deepEqual(snapshot, { cacheRead: 320, cacheWrite: 0, totalInput: 416 });
});

test("OpenAI raw cached_tokens maps to cacheRead", () => {
  const snapshot = normalizeUsageSnapshot({
    prompt_tokens: 200,
    prompt_tokens_details: { cached_tokens: 128 },
  });
  assert.deepEqual(snapshot, { cacheRead: 128, cacheWrite: 0, totalInput: 200 });
});

test("Anthropic raw fields map cacheRead/cacheWrite and total input", () => {
  const snapshot = normalizeUsageSnapshot({
    input_tokens: 10,
    cache_read_input_tokens: 200,
    cache_creation_input_tokens: 30,
  });
  assert.deepEqual(snapshot, {
    cacheRead: 200,
    cacheWrite: 30,
    totalInput: 240,
  });
});

test("unrecognized usage shape returns undefined", () => {
  assert.equal(normalizeUsageSnapshot({ output: 12 }), undefined);
  assert.equal(normalizeUsageSnapshot(null), undefined);
});
