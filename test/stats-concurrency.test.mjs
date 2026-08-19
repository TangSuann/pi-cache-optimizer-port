import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStatsStore } from "../dist/stats.js";

test("concurrent writers preserve every update via lock + read-modify-write", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-stats-"));
  const statsPath = join(dir, "stats.json");
  try {
    const stores = Array.from({ length: 6 }, () =>
      createStatsStore({ statsPath, debounceMs: 0 }),
    );
    await Promise.all(stores.map((store) => store.load()));

    stores.forEach((store, i) => {
      store.record(`provider/model-${i}`, {
        cacheRead: 1000 * (i + 1),
        cacheWrite: 100 * (i + 1),
        totalInput: 2000 * (i + 1),
      });
    });

    // All writers flush at once; without coordination the last writer would
    // clobber the others and only one key would survive.
    await Promise.all(stores.map((store) => store.flush()));

    const raw = JSON.parse(await readFile(statsPath, "utf8"));
    const keys = Object.keys(raw.totalsByModel).sort();
    assert.equal(keys.length, 6);
    for (let i = 0; i < 6; i++) {
      const stats = raw.totalsByModel[`provider/model-${i}`];
      assert.ok(stats, `missing key provider/model-${i}`);
      assert.equal(stats.totalRequests, 1);
      assert.equal(stats.cachedInputTokens, 1000 * (i + 1));
      assert.equal(stats.cacheWriteInputTokens, 100 * (i + 1));
      assert.equal(stats.totalInputTokens, 2000 * (i + 1));
    }

    const leftovers = (await readdir(dir)).filter((name) => name.endsWith(".lock"));
    assert.deepEqual(leftovers, [], "lock file should be released after flush");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
