import type { Atom } from "effect/unstable/reactivity";
import type { EnvironmentRegistry } from "../connection/registry.ts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "./runtime.ts";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";

export function createDocumentEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  const changes = createEnvironmentRpcSubscriptionAtomFamily(runtime, {
    label: "documents:changes",
    tag: "documents.changes",
  });
  const refreshTrigger = (target: {
    readonly environmentId: EnvironmentId;
    readonly input: { readonly projectId: ProjectId };
  }) =>
    changes({ environmentId: target.environmentId, input: { projectId: target.input.projectId } });
  return {
    sourceExcerpt: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "documents:source-excerpt",
      tag: "documents.sourceExcerpt",
    }),
    jobs: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "documents:jobs",
      tag: "documents.jobs",
      staleTimeMs: 0,
      refreshTrigger,
    }),
    cancelJob: createEnvironmentRpcCommand(runtime, {
      label: "documents:cancel-job",
      tag: "documents.cancelJob",
    }),
    retryJob: createEnvironmentRpcCommand(runtime, {
      label: "documents:retry-job",
      tag: "documents.retryJob",
    }),
    list: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "documents:list",
      tag: "documents.list",
      staleTimeMs: 0,
      refreshTrigger,
    }),
    get: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "documents:get",
      tag: "documents.get",
      staleTimeMs: 0,
      refreshTrigger,
    }),
    history: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "documents:history",
      tag: "documents.history",
      staleTimeMs: 0,
      refreshTrigger,
    }),
    execute: createEnvironmentRpcCommand(runtime, {
      label: "documents:execute",
      tag: "documents.execute",
    }),
    import: createEnvironmentRpcCommand(runtime, {
      label: "documents:import",
      tag: "documents.import",
    }),
    export: createEnvironmentRpcCommand(runtime, {
      label: "documents:export",
      tag: "documents.export",
    }),
    generate: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "documents:generate",
      tag: "documents.generate",
      staleTimeMs: 0,
    }),
    createWorkspace: createEnvironmentRpcCommand(runtime, {
      label: "documents:create-workspace",
      tag: "documents.createWorkspace",
    }),
  };
}
