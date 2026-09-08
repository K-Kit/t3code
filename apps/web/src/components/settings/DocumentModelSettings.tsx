import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";

import { useEnvironmentSettings, useUpdateEnvironmentSettings } from "~/hooks/useSettings";
import { getCustomModelOptionsByInstance, resolveAppModelSelectionState } from "~/modelSelection";
import {
  applyProviderInstanceSettings,
  deriveProviderInstanceEntries,
  sortProviderInstanceEntries,
} from "~/providerInstances";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "~/state/server";
import { ProviderModelPicker } from "../chat/ProviderModelPicker";
import { TraitsPicker } from "../chat/TraitsPicker";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";

export function DocumentModelSettings({
  environmentId,
}: {
  readonly environmentId: EnvironmentId;
}) {
  const settings = useEnvironmentSettings(environmentId);
  const updateSettings = useUpdateEnvironmentSettings(environmentId);
  const config = useAtomValue(serverEnvironment.configValueAtom(environmentId));
  const providers = (config?.providers ?? EMPTY_SERVER_PROVIDERS).filter(
    (provider) =>
      (provider.driver === "codex" || provider.driver === "claudeAgent") &&
      provider.supportsTextGeneration !== false,
  );
  const selection = resolveAppModelSelectionState(settings, providers);
  const entries = sortProviderInstanceEntries(
    applyProviderInstanceSettings(deriveProviderInstanceEntries(providers), settings),
  );
  const selectedEntry = entries.find((entry) => entry.instanceId === selection.instanceId);
  const available = entries.some((entry) => entry.enabled && entry.isAvailable);
  const modelOptions = getCustomModelOptionsByInstance(
    settings,
    providers,
    selection.instanceId,
    selection.model,
  );

  return (
    <SettingsPageContainer>
      <SettingsSection title="Writing model">
        <SettingsRow
          title="Model"
          description="Used to draft and revise documents on this computer. Connect an AI account first."
          control={
            available ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ProviderModelPicker
                  activeInstanceId={selection.instanceId}
                  model={selection.model}
                  lockedProvider={null}
                  instanceEntries={entries}
                  modelOptionsByInstance={modelOptions}
                  triggerVariant="outline"
                  onInstanceModelChange={(instanceId, model) =>
                    updateSettings({
                      textGenerationModelSelection: resolveAppModelSelectionState(
                        {
                          ...settings,
                          textGenerationModelSelection: createModelSelection(instanceId, model),
                        },
                        providers,
                      ),
                    })
                  }
                />
                {selectedEntry ? (
                  <TraitsPicker
                    provider={selectedEntry.driverKind}
                    models={selectedEntry.models}
                    model={selection.model}
                    prompt=""
                    onPromptChange={() => {}}
                    modelOptions={selection.options}
                    allowPromptInjectedEffort={false}
                    planModeEnabled={false}
                    triggerVariant="outline"
                    onModelOptionsChange={(options) =>
                      updateSettings({
                        textGenerationModelSelection: createModelSelection(
                          selection.instanceId,
                          selection.model,
                          options,
                        ),
                      })
                    }
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Connect an AI account to choose a model.
              </p>
            )
          }
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
