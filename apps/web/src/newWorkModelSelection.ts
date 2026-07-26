import {
  DEFAULT_MODEL,
  type ModelSelection,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";

const CODEX_NEW_WORK_SELECTION: ModelSelection = {
  instanceId: ProviderInstanceId.make("codex"),
  model: DEFAULT_MODEL,
};

export function resolveNewWorkModelSelection(input: {
  readonly providers: ReadonlyArray<ServerProvider>;
  readonly existingSelection: ModelSelection | null | undefined;
}): ModelSelection {
  if (input.existingSelection) {
    return input.existingSelection;
  }

  const modelReadyProviders = input.providers.filter(
    (provider) =>
      provider.enabled &&
      provider.availability !== "unavailable" &&
      provider.status === "ready" &&
      provider.models.length > 0,
  );
  const provider =
    modelReadyProviders.find((candidate) => candidate.driver === "pi") ?? modelReadyProviders[0];
  const model = provider?.models[0];
  return provider && model
    ? { instanceId: provider.instanceId, model: model.slug }
    : CODEX_NEW_WORK_SELECTION;
}
