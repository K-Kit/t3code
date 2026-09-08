import { serializeComposerFileLink } from "@t3tools/shared/composerTrigger";

export function workspaceFileChatPrompt(relativePath: string) {
  return `Help me with this file: ${serializeComposerFileLink(relativePath)}\n\nAsk what I want to accomplish before changing the file.`;
}
