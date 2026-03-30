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

// Claude SDK skill/command directories
const userClaudeSkillsDir = () => path.join(os.homedir(), ".claude", "skills");
const userClaudeCommandsDir = () => path.join(os.homedir(), ".claude", "commands");
const projectClaudeSkillsDir = (cwd: string) => path.join(cwd, ".claude", "skills");
const projectClaudeCommandsDir = (cwd: string) => path.join(cwd, ".claude", "commands");

// Claude plugin manifest
const installedPluginsPath = () =>
  path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json");

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

// ── Claude Command File Scanning ───────────────────────────────────

/**
 * Read `.claude/commands/` directories where each `.md` file is a command.
 * Returns SkillSummary entries with source metadata.
 */
async function readClaudeCommandSummaries(
  dir: string,
  sourceLabel: string,
): Promise<SkillSummary[]> {
  let entries: string[];
  try {
    entries = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }

  const results: SkillSummary[] = [];
  for (const file of entries) {
    const filePath = path.join(dir, file);
    const name = file.replace(/\.md$/, "");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const frontmatter = parseFrontmatter(content);
      results.push({
        name: frontmatter.name ?? name,
        enabled: true,
        ...(frontmatter.description ? { description: frontmatter.description } : {}),
        ...(frontmatter.allowedTools && frontmatter.allowedTools.length > 0
          ? { allowedTools: frontmatter.allowedTools }
          : {}),
        source: sourceLabel,
      });
    } catch {
      results.push({ name, enabled: true, source: sourceLabel });
    }
  }

  // Also check for subdirectories (namespaced commands like frontend/component.md)
  let dirEntries: import("node:fs").Dirent[];
  try {
    dirEntries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    const subDir = path.join(dir, entry.name);
    const subResults = await readClaudeCommandSummaries(subDir, sourceLabel);
    results.push(...subResults);
  }

  return results;
}

/**
 * Read `.claude/skills/` directories (Claude SDK format: each subdirectory has SKILL.md).
 */
async function readClaudeSkillSummaries(
  dir: string,
  sourceLabel: string,
): Promise<SkillSummary[]> {
  const skillNames = await readSkillDirs(dir);
  const results: SkillSummary[] = [];
  for (const name of skillNames) {
    const skillMdPath = path.join(dir, name, "SKILL.md");
    try {
      const content = await fs.readFile(skillMdPath, "utf-8");
      const frontmatter = parseFrontmatter(content);
      results.push({
        name: frontmatter.name ?? name,
        enabled: true,
        ...(frontmatter.description ? { description: frontmatter.description } : {}),
        ...(frontmatter.version ? { version: frontmatter.version } : {}),
        ...(frontmatter.allowedTools && frontmatter.allowedTools.length > 0
          ? { allowedTools: frontmatter.allowedTools }
          : {}),
        source: sourceLabel,
      });
    } catch {
      results.push({ name, enabled: true, source: sourceLabel });
    }
  }
  return results;
}

// ── Plugin Scanning ────────────────────────────────────────────────

interface InstalledPluginEntry {
  scope?: string;
  installPath?: string;
  version?: string;
  installedAt?: string;
}

interface InstalledPluginsManifest {
  version?: number;
  plugins?: Record<string, InstalledPluginEntry[]>;
}

/**
 * Read ~/.claude/settings.json to get the enabledPlugins map.
 * Returns a map of pluginKey → boolean (true = enabled).
 */
async function readEnabledPlugins(): Promise<Record<string, boolean>> {
  try {
    const raw = await fs.readFile(
      path.join(os.homedir(), ".claude", "settings.json"),
      "utf-8",
    );
    const settings = JSON.parse(raw) as { enabledPlugins?: Record<string, boolean> };
    return settings.enabledPlugins ?? {};
  } catch {
    return {};
  }
}

/**
 * Read installed_plugins.json and scan each plugin's skills/ directory.
 * Only includes skills from plugins that are enabled in settings.json.
 * Plugin names use `plugin:<name>` as their source label and are namespaced
 * as `<pluginName>:<skillName>` when the plugin provides multiple skills.
 */
async function readPluginSkillSummaries(): Promise<SkillSummary[]> {
  const [manifest, enabledPlugins] = await Promise.all([
    fs
      .readFile(installedPluginsPath(), "utf-8")
      .then((raw) => JSON.parse(raw) as InstalledPluginsManifest)
      .catch(() => ({ plugins: {} }) as InstalledPluginsManifest),
    readEnabledPlugins(),
  ]);

  if (!manifest.plugins) return [];

  const results: SkillSummary[] = [];

  for (const [pluginKey, entries] of Object.entries(manifest.plugins)) {
    // Skip plugins that are explicitly disabled in settings
    if (enabledPlugins[pluginKey] === false) continue;

    // Use first entry (latest install) for each plugin
    const entry = entries[0];
    if (!entry?.installPath) continue;

    const pluginSkillsDir = path.join(entry.installPath, "skills");
    const skillNames = await readSkillDirs(pluginSkillsDir);

    // Derive a short plugin name from "pluginName@marketplace" format
    const pluginName = pluginKey.split("@")[0] ?? pluginKey;

    for (const skillDirName of skillNames) {
      const skillMdPath = path.join(pluginSkillsDir, skillDirName, "SKILL.md");
      try {
        const content = await fs.readFile(skillMdPath, "utf-8");
        const frontmatter = parseFrontmatter(content);
        const name = frontmatter.name ?? skillDirName;
        results.push({
          name: skillNames.length > 1 ? `${pluginName}:${name}` : name,
          enabled: true,
          ...(frontmatter.description ? { description: frontmatter.description } : {}),
          ...(frontmatter.version
            ? { version: frontmatter.version }
            : entry.version && entry.version !== "unknown"
              ? { version: entry.version }
              : {}),
          ...(frontmatter.allowedTools && frontmatter.allowedTools.length > 0
            ? { allowedTools: frontmatter.allowedTools }
            : {}),
          source: `plugin:${pluginName}`,
          ...(entry.installedAt ? { installedAt: entry.installedAt } : {}),
        });
      } catch {
        results.push({
          name: skillNames.length > 1 ? `${pluginName}:${skillDirName}` : skillDirName,
          enabled: true,
          source: `plugin:${pluginName}`,
          ...(entry.installedAt ? { installedAt: entry.installedAt } : {}),
        });
      }
    }
  }

  return results;
}

// ── Exported Effect Functions ───────────────────────────────────────

export const listSkills = (
  projectCwd?: string,
): Effect.Effect<SkillsListResult, SkillsError> =>
  Effect.tryPromise({
    try: async () => {
      const lockData = await readLockFile();
      const [enabledNames, disabledNames] = await Promise.all([
        readSkillDirs(skillsDir()),
        readSkillDirs(skillsBackupDir()),
      ]);

      // ~/.agents/skills (managed skills)
      const agentsSummaries = await Promise.all([
        ...enabledNames.map((name) => readSkillSummary(skillsDir(), name, true, lockData)),
        ...disabledNames.map((name) => readSkillSummary(skillsBackupDir(), name, false, lockData)),
      ]);

      // Claude SDK directories (always enabled, read-only)
      const claudeSummaries = await Promise.all([
        readClaudeSkillSummaries(userClaudeSkillsDir(), "claude:user"),
        readClaudeCommandSummaries(userClaudeCommandsDir(), "claude:user-command"),
        ...(projectCwd
          ? [
              readClaudeSkillSummaries(projectClaudeSkillsDir(projectCwd), "claude:project"),
              readClaudeCommandSummaries(projectClaudeCommandsDir(projectCwd), "claude:project-command"),
            ]
          : []),
      ]);

      // Installed Claude Code plugins
      const pluginSummaries = await readPluginSkillSummaries();

      // Merge and deduplicate (managed > claude > plugin)
      const managedSkills = agentsSummaries.filter((s): s is SkillSummary => s !== null);
      const seenNames = new Set(managedSkills.map((s) => s.name));

      const claudeSkills = claudeSummaries.flat().filter((s) => {
        if (seenNames.has(s.name)) return false;
        seenNames.add(s.name);
        return true;
      });

      const pluginSkills = pluginSummaries.filter((s) => {
        if (seenNames.has(s.name)) return false;
        seenNames.add(s.name);
        return true;
      });

      const skills = [...managedSkills, ...claudeSkills, ...pluginSkills].toSorted((a, b) =>
        a.name.localeCompare(b.name),
      );

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
