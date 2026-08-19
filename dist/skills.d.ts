export type SkillInfo = {
    name: string;
    description?: string;
    filePath: string;
    disableModelInvocation?: boolean;
};
export declare const SKILL_COMPRESSION_MIN_COUNT = 4;
export declare function formatSkillsForPrompt(skills: SkillInfo[]): string;
export declare function formatSkillsForPromptCompressed(skills: SkillInfo[]): string;
/**
 * Replace the verbose `<available_skills>` block with the compressed
 * one-index form. Idempotent via a double guard: it no-ops when the verbose
 * block is absent, and no-ops when the compressed form is not shorter.
 */
export declare function compressSkillsInSystemPrompt(prompt: string, skills: SkillInfo[]): string;
