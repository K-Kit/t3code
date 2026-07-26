// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { PiSettings, ProviderInstanceId, TextGenerationError } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { makePiTextGeneration } from "./PiTextGeneration.ts";

const decodePiSettings = Schema.decodeSync(PiSettings);

async function makeMockPi(providerError: unknown) {
  const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-pi-text-"));
  const binaryPath = NodePath.join(directory, "mock-pi.mjs");
  await NodeFSP.writeFile(
    binaryPath,
    `#!/usr/bin/env node
let input = "";
const providerError = ${JSON.stringify(providerError)};
const send = (value) => process.stdout.write(JSON.stringify(value) + "\\n");
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  while (input.includes("\\n")) {
    const at = input.indexOf("\\n");
    const line = input.slice(0, at).replace(/\\r$/, "");
    input = input.slice(at + 1);
    if (!line) continue;
    const command = JSON.parse(line);
    if (command.type === "get_available_models") {
      send({ id: command.id, type: "response", command: command.type, success: true, data: { models: [{ id: "mock-model", name: "Mock", provider: "mock" }] } });
    } else if (command.type === "set_model") {
      send({ id: command.id, type: "response", command: command.type, success: true });
    } else if (command.type === "prompt") {
      send({ id: command.id, type: "response", command: command.type, success: true });
      send({ type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "{\\"title\\":\\"parseable partial output\\"}" } });
      send(providerError);
      send({ type: "agent_settled" });
    }
  }
});
process.on("SIGTERM", () => process.exit(0));
`,
    "utf8",
  );
  await NodeFSP.chmod(binaryPath, 0o755);
  return { binaryPath, directory };
}

function generateAfterProviderError(providerError: unknown) {
  return Effect.gen(function* () {
    const mock = yield* Effect.promise(() => makeMockPi(providerError));
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => NodeFSP.rm(mock.directory, { recursive: true, force: true })),
    );
    const textGeneration = yield* makePiTextGeneration(
      decodePiSettings({ enabled: true, binaryPath: mock.binaryPath, customModels: [] }),
    );
    return yield* textGeneration
      .generateThreadTitle({
        cwd: process.cwd(),
        message: "Generate a title",
        modelSelection: createModelSelection(ProviderInstanceId.make("pi"), "mock/mock-model"),
      })
      .pipe(Effect.flip);
  }).pipe(Effect.scoped);
}

describe("PiTextGeneration", () => {
  it.effect("rejects parseable partial JSON followed by an assistant provider error", () =>
    Effect.gen(function* () {
      const error = yield* generateAfterProviderError({
        type: "message_update",
        message: {
          role: "assistant",
          stopReason: "error",
          errorMessage: "mock upstream provider failure",
        },
        assistantMessageEvent: {
          type: "error",
          reason: "error",
          error: { errorMessage: "mock upstream provider failure" },
        },
      });

      assert.instanceOf(error, TextGenerationError);
      assert.match(error.detail, /mock upstream provider failure/);
      assert.deepInclude(error.cause, {
        _tag: "PiTextGenerationProviderError",
        detail: "Pi assistant message failed: mock upstream provider failure",
      });
    }),
  );

  it.effect("rejects parseable partial JSON followed by an extension error", () =>
    Effect.gen(function* () {
      const error = yield* generateAfterProviderError({
        type: "extension_error",
        extension: "mock-extension",
        error: { message: "mock upstream extension failure" },
      });

      assert.instanceOf(error, TextGenerationError);
      assert.match(error.detail, /mock upstream extension failure/);
      assert.deepInclude(error.cause, {
        _tag: "PiTextGenerationProviderError",
        detail: "Pi extension failed: mock upstream extension failure",
      });
    }),
  );
});
