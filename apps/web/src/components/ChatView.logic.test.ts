import { ThreadId, type SkillSummary } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  buildComposerSlashCommandItems,
  buildExpiredTerminalContextToastCopy,
  deriveComposerSendState,
} from "./ChatView.logic";

describe("deriveComposerSendState", () => {
  it("treats expired terminal pills as non-sendable content", () => {
    const state = deriveComposerSendState({
      prompt: "\uFFFC",
      imageCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("");
    expect(state.sendableTerminalContexts).toEqual([]);
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(false);
  });

  it("keeps text sendable while excluding expired terminal pills", () => {
    const state = deriveComposerSendState({
      prompt: `yoo \uFFFC waddup`,
      imageCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("yoo  waddup");
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(true);
  });
});

describe("buildExpiredTerminalContextToastCopy", () => {
  it("formats clear empty-state guidance", () => {
    expect(buildExpiredTerminalContextToastCopy(1, "empty")).toEqual({
      title: "Expired terminal context won't be sent",
      description: "Remove it or re-add it to include terminal output.",
    });
  });

  it("formats omission guidance for sent messages", () => {
    expect(buildExpiredTerminalContextToastCopy(2, "omitted")).toEqual({
      title: "Expired terminal contexts omitted from message",
      description: "Re-add it if you want that terminal output included.",
    });
  });
});

describe("buildComposerSlashCommandItems", () => {
  const enabledSkill: SkillSummary = {
    name: "frontend-design",
    description: "Build polished interfaces",
    source: "local",
    enabled: true,
  };

  const disabledSkill: SkillSummary = {
    name: "hidden-skill",
    description: "Should not appear",
    enabled: false,
  };

  it("shows built-in slash commands before enabled skills", () => {
    expect(
      buildComposerSlashCommandItems({
        query: "",
        skills: [enabledSkill, disabledSkill],
      }),
    ).toEqual([
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
        id: "skill:frontend-design",
        type: "skill",
        skillName: "frontend-design",
        label: "frontend-design",
        description: "Build polished interfaces",
      },
    ]);
  });

  it("filters against skill fields while excluding disabled skills", () => {
    expect(
      buildComposerSlashCommandItems({
        query: "front",
        skills: [enabledSkill, disabledSkill],
      }),
    ).toEqual([
      {
        id: "skill:frontend-design",
        type: "skill",
        skillName: "frontend-design",
        label: "frontend-design",
        description: "Build polished interfaces",
      },
    ]);
  });

  it("falls back to a generic skill description when metadata is missing", () => {
    expect(
      buildComposerSlashCommandItems({
        query: "plain",
        skills: [{ name: "plain-skill", enabled: true }],
      }),
    ).toEqual([
      {
        id: "skill:plain-skill",
        type: "skill",
        skillName: "plain-skill",
        label: "plain-skill",
        description: "Skill",
      },
    ]);
  });
});
