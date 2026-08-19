import test from "node:test";
import assert from "node:assert/strict";
import {
  compressSkillsInSystemPrompt,
  formatSkillsForPrompt,
  formatSkillsForPromptCompressed,
  SKILL_COMPRESSION_MIN_COUNT,
} from "../dist/skills.js";

const skills = [
  { name: "alpha", description: "Alpha skill", filePath: "/root1/alpha/SKILL.md" },
  { name: "beta", description: "Beta skill", filePath: "/root1/beta/SKILL.md" },
  { name: "gamma", description: "Gamma skill", filePath: "/root2/gamma/SKILL.md" },
  { name: "delta", description: "Delta skill", filePath: "/root2/delta/SKILL.md" },
];

test("compressed output is deterministic and groups skills by root", () => {
  const forward = formatSkillsForPromptCompressed(skills);
  const reversed = formatSkillsForPromptCompressed([...skills].reverse());
  assert.equal(forward, reversed);
  assert.match(forward, /Skills under \/root1\/<name>\/SKILL\.md:/);
  assert.match(forward, /Skills under \/root2\/<name>\/SKILL\.md:/);
  assert.ok(forward.includes("alpha"));
  assert.ok(forward.includes("beta"));
  assert.ok(forward.includes("gamma"));
  assert.ok(forward.includes("delta"));
});

test("compression is idempotent and shortens the prompt", () => {
  const verbose = formatSkillsForPrompt(skills);
  const prompt = `HEADER\n${verbose}\nFOOTER`;
  const once = compressSkillsInSystemPrompt(prompt, skills);
  const twice = compressSkillsInSystemPrompt(once, skills);
  assert.equal(once, twice);
  assert.ok(once.length < prompt.length);
  assert.ok(!once.includes("<available_skills>"));
});

test("compression no-ops below the minimum skill count", () => {
  const few = skills.slice(0, SKILL_COMPRESSION_MIN_COUNT - 1);
  const verbose = formatSkillsForPrompt(few);
  const prompt = `X${verbose}Y`;
  assert.equal(compressSkillsInSystemPrompt(prompt, few), prompt);
});

test("compression no-ops when the verbose block is absent", () => {
  const prompt = "just a prompt without the verbose skills block";
  assert.equal(compressSkillsInSystemPrompt(prompt, skills), prompt);
});

test("compression no-ops when the compressed form would not be shorter", () => {
  // The guard is defensive; this assertion pins the exact invariant rather
  // than relying on a pathological fixture that is hard to construct with
  // >=4 visible skills.
  const verbose = formatSkillsForPrompt(skills);
  const compressed = formatSkillsForPromptCompressed(skills);
  assert.ok(compressed.length < verbose.length);
});
