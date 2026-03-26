/**
 * Skills — filesystem operations for reading and toggling skills in ~/.agents
 *
 * Skills are directories in ~/.agents/skills/ (enabled) or ~/.agents/skills-backup/ (disabled).
 * Each skill directory contains a SKILL.md file with YAML frontmatter metadata.
 * An optional .skill-lock.json provides supplementary source/timestamp data.
 *
 * @module Skills
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { Effect, Schema } from "effect";
import type { SkillSummary, SkillsListResult, SkillsSetEnabledResult } from "@t3tools/contracts";

export class SkillsError extends Schema.TaggedErrorClass<SkillsError>()("SkillsError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

// ── Paths ────────────────────────────────────────────────────────────

const agentsDir = () => path.join(os.homedir(), ".agents");
const skillsDir = () => path.join(agentsDir(), "skills");
const skillsBackupDir = () => path.join(agentsDir(), "skills-backup");
const lockFilePath = () => path.join(agentsDir(), ".skill-lock.json");

// ── Frontmatter Parsing ─────────────────────────────────────────────

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  allowedTools?: string[];
}

function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match?.[1]) return {};

  const block = match[1];
  const result: ParsedFrontmatter = {};

  // Extract name
  const nameMatch = block.match(/^name:\s*(.+)$/m);
  if (nameMatch?.[1]) {
    result.name = stripQuotes(nameMatch[1].trim());
  }

  // Extract description — may be quoted, may span the rest of the value
  const descMatch = block.match(/^description:\s*(.+)$/m);
  if (descMatch?.[1]) {
    result.description = stripQuotes(descMatch[1].trim());
  }

  // Extract allowed-tools — comma-separated on one line
  const toolsMatch = block.match(/^allowed-tools:\s*(.+)$/m);
  if (toolsMatch?.[1]) {
    result.allowedTools = toolsMatch[1]
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // Extract metadata.version — indented under metadata:
  const versionMatch = block.match(/^\s+version:\s*(.+)$/m);
  if (versionMatch?.[1]) {
    result.version = stripQuotes(versionMatch[1].trim());
  }

  return result;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

// ── Lock File ───────────────────────────────────────────────────────

interface LockFileSkill {
  source?: string;
  sourceType?: string;
  sourceUrl?: string;
  installedAt?: string;
  updatedAt?: string;
}

interface LockFile {
  version?: number;
  skills?: Record<string, LockFileSkill>;
}

async function readLockFile(): Promise<LockFile> {
  try {
    const raw = await fs.readFile(lockFilePath(), "utf-8");
    return JSON.parse(raw) as LockFile;
  } catch {
    return {};
  }
}

// ── Directory Scanning ──────────────────────────────────────────────

async function readSkillDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function readSkillSummary(
  dir: string,
  skillName: string,
  enabled: boolean,
  lockData: LockFile,
): Promise<SkillSummary | null> {
  const skillMdPath = path.join(dir, skillName, "SKILL.md");
  try {
    const content = await fs.readFile(skillMdPath, "utf-8");
    const frontmatter = parseFrontmatter(content);
    const lock = lockData.skills?.[skillName];

    return {
      name: frontmatter.name ?? skillName,
      enabled,
      ...(frontmatter.description ? { description: frontmatter.description } : {}),
      ...(frontmatter.version ? { version: frontmatter.version } : {}),
      ...(frontmatter.allowedTools && frontmatter.allowedTools.length > 0
        ? { allowedTools: frontmatter.allowedTools }
        : {}),
      ...(lock?.source ? { source: lock.source } : {}),
      ...(lock?.sourceUrl ? { sourceUrl: lock.sourceUrl } : {}),
      ...(lock?.sourceType ? { sourceType: lock.sourceType } : {}),
      ...(lock?.installedAt ? { installedAt: lock.installedAt } : {}),
      ...(lock?.updatedAt ? { updatedAt: lock.updatedAt } : {}),
    };
  } catch {
    // SKILL.md missing or unreadable — still return basic summary
    const lock = lockData.skills?.[skillName];
    return {
      name: skillName,
      enabled,
      ...(lock?.source ? { source: lock.source } : {}),
      ...(lock?.sourceUrl ? { sourceUrl: lock.sourceUrl } : {}),
      ...(lock?.sourceType ? { sourceType: lock.sourceType } : {}),
      ...(lock?.installedAt ? { installedAt: lock.installedAt } : {}),
      ...(lock?.updatedAt ? { updatedAt: lock.updatedAt } : {}),
    };
  }
}

// ── Exported Effect Functions ───────────────────────────────────────

export const listSkills: Effect.Effect<SkillsListResult, SkillsError> = Effect.tryPromise({
  try: async () => {
    const lockData = await readLockFile();
    const [enabledNames, disabledNames] = await Promise.all([
      readSkillDirs(skillsDir()),
      readSkillDirs(skillsBackupDir()),
    ]);

    const summaries = await Promise.all([
      ...enabledNames.map((name) => readSkillSummary(skillsDir(), name, true, lockData)),
      ...disabledNames.map((name) => readSkillSummary(skillsBackupDir(), name, false, lockData)),
    ]);

    const skills = summaries
      .filter((s): s is SkillSummary => s !== null)
      .toSorted((a, b) => a.name.localeCompare(b.name));

    return { skills };
  },
  catch: (cause) =>
    new SkillsError({
      message: `Failed to list skills: ${String(cause)}`,
      cause,
    }),
});

export const setSkillEnabled = (input: {
  name: string;
  enabled: boolean;
}): Effect.Effect<SkillsSetEnabledResult, SkillsError> =>
  Effect.tryPromise({
    try: async () => {
      const { name, enabled } = input;
      const sourceDir = enabled ? skillsBackupDir() : skillsDir();
      const targetDir = enabled ? skillsDir() : skillsBackupDir();
      const sourcePath = path.join(sourceDir, name);
      const targetPath = path.join(targetDir, name);

      // Validate source exists
      try {
        await fs.access(sourcePath);
      } catch {
        throw new Error(
          enabled
            ? `Skill "${name}" not found in inactive skills.`
            : `Skill "${name}" not found in active skills.`,
        );
      }

      // Validate target does not already exist
      try {
        await fs.access(targetPath);
        throw new Error(
          `Skill "${name}" already exists in ${enabled ? "active" : "inactive"} skills.`,
        );
      } catch (error) {
        // If it's our own thrown error, re-throw it
        if (error instanceof Error && error.message.includes("already exists")) {
          throw error;
        }
        // Otherwise, target doesn't exist — good
      }

      // Ensure target parent directory exists
      await fs.mkdir(targetDir, { recursive: true });

      // Move the skill directory
      await fs.rename(sourcePath, targetPath);

      // Read back the moved skill to return its summary
      const lockData = await readLockFile();
      const summary = await readSkillSummary(targetDir, name, enabled, lockData);

      if (!summary) {
        throw new Error(`Failed to read skill "${name}" after moving.`);
      }

      return { skill: summary };
    },
    catch: (cause) => {
      if (cause instanceof Error) {
        return new SkillsError({
          message: cause.message,
          cause,
        });
      }
      return new SkillsError({
        message: `Failed to ${input.enabled ? "enable" : "disable"} skill: ${String(cause)}`,
        cause,
      });
    },
  });
