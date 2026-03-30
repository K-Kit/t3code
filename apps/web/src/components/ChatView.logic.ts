import {
  ProjectId,
  type ModelSelection,
  type SkillSummary,
  type ThreadId,
} from "@t3tools/contracts";
import { type ChatMessage, type Thread } from "../types";
import { randomUUID } from "~/lib/utils";
import { type ComposerImageAttachment, type DraftThreadState } from "../composerDraftStore";
import { Schema } from "effect";
import {
  filterTerminalContextsWithText,
  stripInlineTerminalContextPlaceholders,
  type TerminalContextDraft,
} from "../lib/terminalContext";
import type { ComposerCommandItem } from "./chat/ComposerCommandMenu";
import type { ComposerSlashCommand } from "../composer-logic";

export const LAST_INVOKED_SCRIPT_BY_PROJECT_KEY = "t3code:last-invoked-script-by-project";
const WORKTREE_BRANCH_PREFIX = "t3code";

export const LastInvokedScriptByProjectSchema = Schema.Record(ProjectId, Schema.String);

export function buildLocalDraftThread(
  threadId: ThreadId,
  draftThread: DraftThreadState,
  fallbackModelSelection: ModelSelection,
  error: string | null,
): Thread {
  return {
    id: threadId,
    codexThreadId: null,
    projectId: draftThread.projectId,
    title: "New thread",
    modelSelection: fallbackModelSelection,
    runtimeMode: draftThread.runtimeMode,
    interactionMode: draftThread.interactionMode,
    session: null,
    messages: [],
    error,
    createdAt: draftThread.createdAt,
    archivedAt: null,
    latestTurn: null,
    lastVisitedAt: draftThread.createdAt,
    branch: draftThread.branch,
    worktreePath: draftThread.worktreePath,
    turnDiffSummaries: [],
    activities: [],
    proposedPlans: [],
  };
}

export function revokeBlobPreviewUrl(previewUrl: string | undefined): void {
  if (!previewUrl || typeof URL === "undefined" || !previewUrl.startsWith("blob:")) {
    return;
  }
  URL.revokeObjectURL(previewUrl);
}

export function revokeUserMessagePreviewUrls(message: ChatMessage): void {
  if (message.role !== "user" || !message.attachments) {
    return;
  }
  for (const attachment of message.attachments) {
    if (attachment.type !== "image") {
      continue;
    }
    revokeBlobPreviewUrl(attachment.previewUrl);
  }
}

export function collectUserMessageBlobPreviewUrls(message: ChatMessage): string[] {
  if (message.role !== "user" || !message.attachments) {
    return [];
  }
  const previewUrls: string[] = [];
  for (const attachment of message.attachments) {
    if (attachment.type !== "image") continue;
    if (!attachment.previewUrl || !attachment.previewUrl.startsWith("blob:")) continue;
    previewUrls.push(attachment.previewUrl);
  }
  return previewUrls;
}

export type SendPhase = "idle" | "preparing-worktree" | "sending-turn";

export interface PullRequestDialogState {
  initialReference: string | null;
  key: number;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read image data."));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Failed to read image."));
    });
    reader.readAsDataURL(file);
  });
}

export function buildTemporaryWorktreeBranchName(): string {
  // Keep the 8-hex suffix shape for backend temporary-branch detection.
  const token = randomUUID().slice(0, 8).toLowerCase();
  return `${WORKTREE_BRANCH_PREFIX}/${token}`;
}

export function cloneComposerImageForRetry(
  image: ComposerImageAttachment,
): ComposerImageAttachment {
  if (typeof URL === "undefined" || !image.previewUrl.startsWith("blob:")) {
    return image;
  }
  try {
    return {
      ...image,
      previewUrl: URL.createObjectURL(image.file),
    };
  } catch {
    return image;
  }
}

export function deriveComposerSendState(options: {
  prompt: string;
  imageCount: number;
  terminalContexts: ReadonlyArray<TerminalContextDraft>;
}): {
  trimmedPrompt: string;
  sendableTerminalContexts: TerminalContextDraft[];
  expiredTerminalContextCount: number;
  hasSendableContent: boolean;
} {
  const trimmedPrompt = stripInlineTerminalContextPlaceholders(options.prompt).trim();
  const sendableTerminalContexts = filterTerminalContextsWithText(options.terminalContexts);
  const expiredTerminalContextCount =
    options.terminalContexts.length - sendableTerminalContexts.length;
  return {
    trimmedPrompt,
    sendableTerminalContexts,
    expiredTerminalContextCount,
    hasSendableContent:
      trimmedPrompt.length > 0 || options.imageCount > 0 || sendableTerminalContexts.length > 0,
  };
}

export function buildExpiredTerminalContextToastCopy(
  expiredTerminalContextCount: number,
  variant: "omitted" | "empty",
): { title: string; description: string } {
  const count = Math.max(1, Math.floor(expiredTerminalContextCount));
  const noun = count === 1 ? "Expired terminal context" : "Expired terminal contexts";
  if (variant === "empty") {
    return {
      title: `${noun} won't be sent`,
      description: "Remove it or re-add it to include terminal output.",
    };
  }
  return {
    title: `${noun} omitted from message`,
    description: "Re-add it if you want that terminal output included.",
  };
}

const BUILT_IN_SLASH_COMMAND_ITEMS = [
  {
    id: "slash:model",
    type: "slash-command",
    command: "model",
    label: "/model",
    description: "Switch response model for this thread",
  },
  {
    id: "slash:plan",
    type: "slash-command",
    command: "plan",
    label: "/plan",
    description: "Switch this thread into plan mode",
  },
  {
    id: "slash:default",
    type: "slash-command",
    command: "default",
    label: "/default",
    description: "Switch this thread back to normal chat mode",
  },
  {
    id: "slash:compact",
    type: "slash-command",
    command: "compact",
    label: "/compact",
    description: "Summarize conversation to reduce context size",
  },
  {
    id: "slash:clear",
    type: "slash-command",
    command: "clear",
    label: "/clear",
    description: "Clear conversation history and start fresh",
  },
  {
    id: "slash:help",
    type: "slash-command",
    command: "help",
    label: "/help",
    description: "Show help information",
  },
] satisfies ReadonlyArray<Extract<ComposerCommandItem, { type: "slash-command" }>>;

function buildComposerSkillItems(options: { query: string; skills: ReadonlyArray<SkillSummary> }) {
  const query = options.query.trim().toLowerCase();
  const enabledSkills = options.skills
    .filter((skill) => skill.enabled)
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return enabledSkills
    .filter((skill) => {
      if (query.length === 0) {
        return true;
      }
      return (
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query) ||
        skill.source?.toLowerCase().includes(query)
      );
    })
    .map(
      (skill) =>
        ({
          id: `skill:${skill.name}`,
          type: "skill",
          skillName: skill.name,
          label: skill.name,
          description: skill.description?.trim() || "Skill",
        }) satisfies Extract<ComposerCommandItem, { type: "skill" }>,
    );
}

export function buildComposerSlashCommandItems(options: {
  query: string;
  skills: ReadonlyArray<SkillSummary>;
  sessionSlashCommands?: ReadonlyArray<string>;
}): ComposerCommandItem[] {
  const query = options.query.trim().toLowerCase();
  const matchingCommands =
    query.length === 0
      ? BUILT_IN_SLASH_COMMAND_ITEMS
      : BUILT_IN_SLASH_COMMAND_ITEMS.filter(
          (item) => item.command.includes(query) || item.label.slice(1).includes(query),
        );

  // Build items for session-provided slash commands not already in built-in list
  const builtInNames = new Set(BUILT_IN_SLASH_COMMAND_ITEMS.map((item) => `/${item.command}`));
  const sessionItems: ComposerCommandItem[] = (options.sessionSlashCommands ?? [])
    .filter((cmd) => !builtInNames.has(cmd))
    .filter((cmd) => {
      if (query.length === 0) return true;
      return cmd.slice(1).toLowerCase().includes(query);
    })
    .map((cmd) => ({
      id: `slash:${cmd.slice(1)}`,
      type: "slash-command" as const,
      command: cmd.slice(1) as ComposerSlashCommand,
      label: cmd,
      description: "Custom slash command",
    }));

  const matchingSkills = buildComposerSkillItems(options);

  return [...matchingCommands, ...sessionItems, ...matchingSkills];
}

export function buildComposerSkillMenuItems(options: {
  query: string;
  skills: ReadonlyArray<SkillSummary>;
}): ComposerCommandItem[] {
  return buildComposerSkillItems(options);
}
