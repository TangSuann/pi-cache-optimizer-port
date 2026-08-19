import test from "node:test";
import assert from "node:assert/strict";
import {
  addUsageToStats,
  formatStatsLine,
  formatTokenCount,
  modelKey,
} from "../dist/stats.js";

function fresh() {
  return {
    totalRequests: 0,
    hitRequests: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    totalInputTokens: 0,
  };
}

test("addUsageToStats accumulates request, hit and token buckets", () => {
  const stats = fresh();
  addUsageToStats(stats, { cacheRead: 320, cacheWrite: 0, totalInput: 416 });
  addUsageToStats(stats, { cacheRead: 0, cacheWrite: 128, totalInput: 200 });
  assert.equal(stats.totalRequests, 2);
  assert.equal(stats.hitRequests, 1);
  assert.equal(stats.cachedInputTokens, 320);
  assert.equal(stats.cacheWriteInputTokens, 128);
  assert.equal(stats.totalInputTokens, 616);
});

test("formatStatsLine matches the requested summary shape", () => {
  const line = formatStatsLine("deepseek/deepseek-v4-flash", {
    totalRequests: 12,
    hitRequests: 9,
    cachedInputTokens: 91234,
    cacheWriteInputTokens: 0,
    totalInputTokens: 201234,
  });
  assert.match(line, /Requests: 9\/12 hit/);
  assert.match(line, /tokens 0\.09M\/0\.20M/);
  assert.match(line, /45\.3%/);
});

test("formatTokenCount abbreviates token counts to M", () => {
  assert.equal(formatTokenCount(90000), "0.09M");
  assert.equal(formatTokenCount(200000), "0.20M");
  assert.equal(formatTokenCount(0), "0M");
});

test("modelKey composes provider/model deterministically", () => {
  assert.equal(modelKey("deepseek", "deepseek-v4-flash"), "deepseek/deepseek-v4-flash");
  assert.equal(modelKey("", "model"), "model");
  assert.equal(modelKey("provider", ""), "provider");
});
