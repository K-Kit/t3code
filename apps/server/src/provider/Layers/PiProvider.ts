import {
  ProviderDriverKind,
  type ModelCapabilities,
  type PiSettings,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { createModelCapabilities } from "@t3tools/shared/model";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  buildServerProvider,
  collectStreamAsString,
  detailFromResult,
  isCommandMissingCause,
  parseGenericCliVersion,
  providerModelsFromSettings,
  type CommandResult,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";

const PROVIDER = ProviderDriverKind.make("pi");
const PI_PRESENTATION = {
  displayName: "Pi",
  showInteractionModeToggle: true,
} as const;
const PI_VERSION_TIMEOUT_MS = 5_000;
const PI_MODELS_TIMEOUT_MS = 20_000;
const SUPPORTED_PI_VERSION = "0.81.1";
const MODEL_DISCOVERY_REQUEST_ID = "t3-pi-model-discovery";
const MISSING_DISCOVERY_RESPONSE_ERROR =
  "Pi RPC did not return a correlated model discovery response.";

const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const PI_REASONING_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [
    {
      id: "thinking",
      label: "Thinking",
      description: "Reasoning effort used by Pi for this model.",
      type: "select",
      currentValue: "medium",
      options: [
        { id: "off", label: "Off" },
        { id: "minimal", label: "Minimal" },
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium", isDefault: true },
        { id: "high", label: "High" },
        { id: "xhigh", label: "Extra High" },
        { id: "max", label: "Max" },
      ],
    },
  ],
});

export interface PiRpcModel {
  readonly provider: string;
  readonly id: string;
  readonly name: string;
  readonly reasoning: boolean;
}

export type PiModelDiscoveryResult =
  | { readonly ok: true; readonly models: ReadonlyArray<PiRpcModel> }
  | { readonly ok: false; readonly error: string };

const PiRpcJsonValue = Schema.fromJsonString(Schema.Unknown);
const decodePiRpcJsonValue = Schema.decodeUnknownOption(PiRpcJsonValue);
const decodePiRpcRecord = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Unknown));
const decodePiRpcModel = Schema.decodeUnknownOption(
  Schema.Struct({
    provider: Schema.String,
    id: Schema.String,
    name: Schema.String,
    reasoning: Schema.optional(Schema.Boolean),
  }),
);
const PiModelDiscoveryRequestJson = Schema.fromJsonString(
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal("get_available_models"),
  }),
);
const encodePiModelDiscoveryRequest = Schema.encodeSync(PiModelDiscoveryRequestJson);

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parsePiRpcModel(value: unknown): PiRpcModel | undefined {
  const decoded = decodePiRpcModel(value);
  if (Option.isNone(decoded)) return undefined;
  const provider = nonEmptyString(decoded.value.provider);
  const id = nonEmptyString(decoded.value.id);
  const name = nonEmptyString(decoded.value.name);
  if (!provider || !id || !name) return undefined;
  return { provider, id, name, reasoning: decoded.value.reasoning === true };
}

/** Parse Pi's LF-delimited RPC output and select only the correlated discovery response. */
export function parsePiAvailableModelsJsonl(
  raw: string,
  requestId: string = MODEL_DISCOVERY_REQUEST_ID,
): PiModelDiscoveryResult {
  if (raw.length > 0 && !raw.endsWith("\n")) {
    return { ok: false, error: "Pi RPC returned an unterminated JSONL record." };
  }

  let matchedResponse: Record<string, unknown> | undefined;
  for (const framedLine of raw.split("\n")) {
    const line = framedLine.endsWith("\r") ? framedLine.slice(0, -1) : framedLine;
    if (line.length === 0) continue;

    const parsed = decodePiRpcJsonValue(line);
    if (Option.isNone(parsed)) {
      return { ok: false, error: "Pi RPC returned malformed JSONL." };
    }
    const record = decodePiRpcRecord(parsed.value);
    if (Option.isNone(record)) {
      return { ok: false, error: "Pi RPC returned a non-object JSONL record." };
    }
    const value = record.value;
    if (value.type === "response" && value.id === requestId) {
      if (matchedResponse) {
        return { ok: false, error: "Pi RPC returned duplicate correlated responses." };
      }
      matchedResponse = value;
    }
  }

  if (!matchedResponse) {
    return { ok: false, error: MISSING_DISCOVERY_RESPONSE_ERROR };
  }
  if (matchedResponse.command !== "get_available_models") {
    return { ok: false, error: "Pi RPC correlated the response to the wrong command." };
  }
  if (matchedResponse.success !== true) {
    const detail = nonEmptyString(matchedResponse.error);
    return {
      ok: false,
      error: detail
        ? `Pi RPC rejected model discovery: ${detail}`
        : "Pi RPC rejected model discovery.",
    };
  }

  const data = decodePiRpcRecord(matchedResponse.data);
  if (Option.isNone(data)) {
    return { ok: false, error: "Pi RPC model discovery returned malformed data." };
  }
  const models = data.value.models;
  if (!Array.isArray(models)) {
    return { ok: false, error: "Pi RPC model discovery did not return a models array." };
  }

  const parsedModels: PiRpcModel[] = [];
  for (const model of models) {
    const parsedModel = parsePiRpcModel(model);
    if (!parsedModel) {
      return { ok: false, error: "Pi RPC model discovery returned a malformed model." };
    }
    parsedModels.push(parsedModel);
  }
  return { ok: true, models: parsedModels };
}

export function buildPiDiscoveredModels(
  models: ReadonlyArray<PiRpcModel>,
): ReadonlyArray<ServerProviderModel> {
  const seen = new Set<string>();
  const discovered: ServerProviderModel[] = [];
  for (const model of models) {
    const slug = `${model.provider}/${model.id}`;
    if (seen.has(slug)) continue;
    seen.add(slug);
    discovered.push({
      slug,
      name: model.name,
      subProvider: model.provider,
      isCustom: false,
      capabilities: model.reasoning ? PI_REASONING_CAPABILITIES : EMPTY_CAPABILITIES,
    });
  }
  return discovered;
}

const runPiCommand = (
  settings: PiSettings,
  args: ReadonlyArray<string>,
  environment: NodeJS.ProcessEnv,
) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const child = yield* spawner.spawn(
      ChildProcess.make(settings.binaryPath, [...args], {
        env: environment,
      }),
    );
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        collectStreamAsString(child.stdout),
        collectStreamAsString(child.stderr),
        child.exitCode.pipe(Effect.map(Number)),
      ],
      { concurrency: "unbounded" },
    );
    return { stdout, stderr, code: exitCode } satisfies CommandResult;
  }).pipe(Effect.scoped);

const discoverPiModels = (
  settings: PiSettings,
  environment: NodeJS.ProcessEnv,
  discoveryRequest: string,
) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const child = yield* spawner.spawn(
      ChildProcess.make(settings.binaryPath, ["--mode", "rpc", "--no-session"], {
        env: environment,
        stdin: {
          stream: Stream.encodeText(Stream.make(discoveryRequest)),
          endOnDone: false,
        },
      }),
    );
    const stderrFiber = yield* collectStreamAsString(child.stderr).pipe(Effect.forkScoped);
    let raw = "";
    let discovery: PiModelDiscoveryResult | undefined;
    yield* child.stdout.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.takeUntilEffect((line) =>
        Effect.sync(() => {
          raw += `${line}\n`;
          const parsed = parsePiAvailableModelsJsonl(raw);
          if (!parsed.ok && parsed.error === MISSING_DISCOVERY_RESPONSE_ERROR) {
            return false;
          }
          discovery = parsed;
          return true;
        }),
      ),
      Stream.runDrain,
    );
    if (discovery) {
      yield* child.kill();
    }
    const [stderr, exitCode] = yield* Effect.all([
      Fiber.join(stderrFiber),
      child.exitCode.pipe(Effect.map(Number)),
    ]);
    return {
      discovery: discovery ?? {
        ok: false,
        error: MISSING_DISCOVERY_RESPONSE_ERROR,
      },
      stderr,
      code: exitCode,
    } as const;
  }).pipe(Effect.scoped);

export const makePendingPiProvider = (settings: PiSettings): Effect.Effect<ServerProviderDraft> =>
  Effect.gen(function* () {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    const models = providerModelsFromSettings(
      [],
      PROVIDER,
      settings.customModels,
      EMPTY_CAPABILITIES,
    );
    return buildServerProvider({
      presentation: PI_PRESENTATION,
      enabled: settings.enabled,
      checkedAt,
      models,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: settings.enabled
          ? "Checking Pi availability..."
          : "Pi is disabled in T3 Code settings.",
      },
    });
  });

function commandFailureMessage(command: string, result: CommandResult): string {
  const detail = detailFromResult(result);
  return detail
    ? `Pi \`${command}\` failed: ${detail}`
    : `Pi \`${command}\` exited without usable output.`;
}

export const checkPiProviderStatus = Effect.fn("checkPiProviderStatus")(function* (
  settings: PiSettings,
  environment: NodeJS.ProcessEnv = process.env,
): Effect.fn.Return<ServerProviderDraft, never, ChildProcessSpawner.ChildProcessSpawner> {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  const fallbackModels = providerModelsFromSettings(
    [],
    PROVIDER,
    settings.customModels,
    EMPTY_CAPABILITIES,
  );
  const buildFailure = (input: {
    readonly installed: boolean;
    readonly version?: string | null;
    readonly message: string;
    readonly status?: "warning" | "error";
  }) =>
    buildServerProvider({
      presentation: PI_PRESENTATION,
      enabled: settings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: input.installed,
        version: input.version ?? null,
        status: input.status ?? "error",
        auth: { status: "unknown" },
        message: input.message,
      },
    });

  if (!settings.enabled) {
    return buildFailure({
      installed: false,
      status: "warning",
      message: "Pi is disabled in T3 Code settings.",
    });
  }

  const binaryName = settings.binaryPath.replaceAll("\\", "/").split("/").at(-1)?.toLowerCase();
  if (binaryName === "senpi" || /^senpi\.(?:bat|cmd|exe)$/u.test(binaryName ?? "")) {
    return buildFailure({
      installed: false,
      message: "Senpi is not upstream Pi. Configure the `pi` executable from the official package.",
    });
  }

  const versionProbe = yield* runPiCommand(settings, ["--version"], environment).pipe(
    Effect.timeoutOption(PI_VERSION_TIMEOUT_MS),
    Effect.result,
  );
  if (Result.isFailure(versionProbe)) {
    const missing = isCommandMissingCause(versionProbe.failure);
    return buildFailure({
      installed: !missing,
      message: missing
        ? "Pi CLI (`pi`) is not installed or not on PATH."
        : `Failed to execute Pi CLI health check: ${versionProbe.failure instanceof Error ? versionProbe.failure.message : String(versionProbe.failure)}.`,
    });
  }
  if (Option.isNone(versionProbe.success)) {
    return buildFailure({
      installed: true,
      message: "Pi CLI timed out while running `pi --version`.",
    });
  }
  const versionResult = versionProbe.success.value;
  if (versionResult.code !== 0) {
    return buildFailure({
      installed: true,
      message: commandFailureMessage("--version", versionResult),
    });
  }
  const version = parseGenericCliVersion(`${versionResult.stdout}\n${versionResult.stderr}`);
  if (!version) {
    return buildFailure({
      installed: true,
      message: "Unable to determine the installed Pi version from `pi --version`.",
    });
  }
  if (version !== SUPPORTED_PI_VERSION) {
    return buildFailure({
      installed: true,
      version,
      message: `Pi ${SUPPORTED_PI_VERSION} is required; found ${version}.`,
    });
  }

  const discoveryRequest = `${encodePiModelDiscoveryRequest({
    id: MODEL_DISCOVERY_REQUEST_ID,
    type: "get_available_models",
  })}\n`;
  const modelsProbe = yield* discoverPiModels(settings, environment, discoveryRequest).pipe(
    Effect.timeoutOption(PI_MODELS_TIMEOUT_MS),
    Effect.result,
  );
  if (Result.isFailure(modelsProbe)) {
    return buildFailure({
      installed: true,
      version,
      status: fallbackModels.length > 0 ? "warning" : "error",
      message: `Failed to discover Pi models: ${modelsProbe.failure instanceof Error ? modelsProbe.failure.message : String(modelsProbe.failure)}.`,
    });
  }
  if (Option.isNone(modelsProbe.success)) {
    return buildFailure({
      installed: true,
      version,
      status: fallbackModels.length > 0 ? "warning" : "error",
      message: "Pi model discovery timed out in RPC mode.",
    });
  }
  const modelsResult = modelsProbe.success.value;
  if (!modelsResult.discovery.ok && modelsResult.code !== 0) {
    return buildFailure({
      installed: true,
      version,
      status: fallbackModels.length > 0 ? "warning" : "error",
      message: commandFailureMessage("--mode rpc", {
        stdout: "",
        stderr: modelsResult.stderr,
        code: modelsResult.code,
      }),
    });
  }

  const parsed = modelsResult.discovery;
  if (!parsed.ok) {
    return buildFailure({
      installed: true,
      version,
      status: fallbackModels.length > 0 ? "warning" : "error",
      message: `Failed to discover Pi models: ${parsed.error}`,
    });
  }

  const discoveredModels = buildPiDiscoveredModels(parsed.models);
  const models = providerModelsFromSettings(
    discoveredModels,
    PROVIDER,
    settings.customModels,
    EMPTY_CAPABILITIES,
  );
  const hasDiscoveredModel = discoveredModels.length > 0;
  return buildServerProvider({
    presentation: PI_PRESENTATION,
    enabled: true,
    checkedAt,
    models,
    probe: {
      installed: true,
      version,
      status: hasDiscoveredModel ? "ready" : "error",
      auth: { status: "unknown" },
      ...(!hasDiscoveredModel
        ? {
            message:
              models.length > 0
                ? "Pi model discovery found no usable models; custom entries do not establish readiness. Configure a model in Pi and refresh."
                : "Pi has no usable configured models. Run `pi`, use `/login` or configure a provider, then refresh.",
          }
        : {}),
    },
  });
});
