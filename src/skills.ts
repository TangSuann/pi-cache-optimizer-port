import { dirname } from "node:path";

export type SkillInfo = {
  name: string;
  description?: string;
  filePath: string;
  disableModelInvocation?: boolean;
};

export const SKILL_COMPRESSION_MIN_COUNT = 4;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function visibleSkills(skills: SkillInfo[]): SkillInfo[] {
  return skills.filter((skill) => !skill.disableModelInvocation);
}

export function formatSkillsForPrompt(skills: SkillInfo[]): string {
  const visible = visibleSkills(skills);
  if (visible.length === 0) return "";

  const lines: string[] = [
    "\n\nThe following skills provide specialized instructions for specific tasks.",
    "Use the read tool to load a skill's file when the task matches its description.",
    "When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
    "",
    "<available_skills>",
  ];

  for (const skill of visible) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeXml(skill.name)}</name>`);
    lines.push(`    <description>${escapeXml(skill.description ?? "")}</description>`);
    lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
    lines.push("  </skill>");
  }

  lines.push("</available_skills>");
  return lines.join("\n");
}

export function formatSkillsForPromptCompressed(skills: SkillInfo[]): string {
  const visible = visibleSkills(skills);
  if (visible.length === 0) return "";

  const groups = new Map<string, string[]>();
  for (const skill of visible) {
    // skill.filePath = .../<skill-name>/SKILL.md, so dirname is the
    // skill directory and dirname-of-dirname is the skills root.
    const skillDir = dirname(skill.filePath);
    const root = dirname(skillDir);
    const list = groups.get(root) ?? [];
    list.push(skill.name);
    groups.set(root, list);
  }

  // Sort group entries by root for determinism.
  const sortedGroups = [...groups.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

  const lines: string[] = [
    "",
    "",
    "The following skills provide specialized instructions for specific tasks. When a skill name matches the task you are doing, read the SKILL.md at the listed location to load the full instructions. When a SKILL.md references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
  ];

  for (const [root, names] of sortedGroups) {
    names.sort();
    lines.push("");
    lines.push(`Skills under ${root}/<name>/SKILL.md:`);

    // Wrap the name list at ~80 columns without affecting determinism.
    let buf = "  ";
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const piece = (buf === "  " ? "" : ", ") + name;
      if (buf.length > 2 && buf.length + piece.length > 80) {
        lines.push(`${buf},`);
        buf = `  ${name}`;
      } else {
        buf += piece;
      }
    }
    if (buf.length > 2) lines.push(buf);
  }

  return lines.join("\n");
}

/**
 * Replace the verbose `<available_skills>` block with the compressed
 * one-index form. Idempotent via a double guard: it no-ops when the verbose
 * block is absent, and no-ops when the compressed form is not shorter.
 */
export function compressSkillsInSystemPrompt(
  prompt: string,
  skills: SkillInfo[],
): string {
  if (!skills || skills.length === 0) return prompt;

  const visible = visibleSkills(skills);
  if (visible.length < SKILL_COMPRESSION_MIN_COUNT) return prompt;

  const verbose = formatSkillsForPrompt(skills);
  if (!verbose || !prompt.includes(verbose)) return prompt;

  const compressed = formatSkillsForPromptCompressed(skills);
  if (!compressed || compressed.length >= verbose.length) return prompt;

  return prompt.replace(verbose, compressed);
}
