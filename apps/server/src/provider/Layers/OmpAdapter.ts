/**
 * OMP CLI (`omp acp`) adapter.
 *
 * OMP speaks the same standard ACP transport as Cursor, so all session,
 * turn, event, attachment, resume, permission, and elicitation behavior lives
 * in the shared ACP adapter factory. This module owns only OMP-specific spawn,
 * authentication, model configuration, and approval-policy choices.
 */
import { type OmpSettings, ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { mapAcpToAdapterError } from "../acp/AcpAdapterSupport.ts";
import {
  applyOmpAcpModelSelection,
  makeOmpAcpRuntime,
  rewriteOmpSkillInvocations,
} from "../acp/OmpAcpSupport.ts";
import type { OmpAdapterShape } from "../Services/OmpAdapter.ts";
import { makeAcpProviderAdapter, type AcpProviderAdapterLiveOptions } from "./CursorAdapter.ts";

const PROVIDER = ProviderDriverKind.make("omp");

export type OmpAdapterLiveOptions = AcpProviderAdapterLiveOptions<OmpSettings>;

export function makeOmpAdapter(ompSettings: OmpSettings, options?: OmpAdapterLiveOptions) {
  return makeAcpProviderAdapter({
    provider: PROVIDER,
    defaultInstanceId: ProviderInstanceId.make("omp"),
    displayName: "OMP",
    settings: ompSettings,
    ...(options ? { options } : {}),
    makeRuntime: ({
      settings,
      environment,
      childProcessSpawner,
      cwd,
      runtimeMode,
      resumeSessionId,
      clientInfo,
      nativeLoggers,
    }) =>
      makeOmpAcpRuntime({
        ompSettings: settings,
        ...(environment ? { environment } : {}),
        childProcessSpawner,
        cwd,
        runtimeMode,
        ...(resumeSessionId ? { resumeSessionId } : {}),
        clientInfo,
        ...nativeLoggers,
      }),
    applyModelSelection: ({ runtime, threadId, model, selections }) =>
      applyOmpAcpModelSelection({
        runtime,
        model,
        selections,
        mapError: ({ cause }) =>
          mapAcpToAdapterError(PROVIDER, threadId, "session/set_config_option", cause),
      }),
    resolveModelId: (model) => model?.trim() || "default",
    // OMP executes skills via `/skill:<name>` and does not expand `@path`
    // prompt text over ACP, so composer tokens are translated client-side.
    rewritePromptText: ({ text, availableCommands }) =>
      rewriteOmpSkillInvocations(text, availableCommands),
    embedMentionedFiles: true,
  }).pipe(Effect.map((adapter) => adapter satisfies OmpAdapterShape));
}
