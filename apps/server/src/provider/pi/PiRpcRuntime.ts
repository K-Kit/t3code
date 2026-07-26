// @effect-diagnostics nodeBuiltinImport:off
import * as NodeChildProcess from "node:child_process";

import * as Effect from "effect/Effect";

import {
  encodePiRpcCommand,
  isPiRpcResponse,
  PiRpcJsonlDecoder,
  type PiRpcCommand,
  type PiRpcEvent,
  type PiRpcModel,
  type PiRpcRecord,
  type PiRpcResponse,
  piRpcModelsFromResponse,
} from "./PiRpcProtocol.ts";

export type PiRpcRuntimeErrorKind =
  | "spawn"
  | "protocol"
  | "process"
  | "request"
  | "write"
  | "closed"
  | "cancelled";

export class PiRpcRuntimeError extends Error {
  override readonly name = "PiRpcRuntimeError";

  readonly kind: PiRpcRuntimeErrorKind;
  readonly command: string | undefined;
  readonly stderr: string | undefined;

  constructor(
    kind: PiRpcRuntimeErrorKind,
    message: string,
    command?: string,
    stderr?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.kind = kind;
    this.command = command;
    this.stderr = stderr;
  }
}

export interface PiRpcRuntimeOptions {
  readonly binaryPath: string;
  readonly cwd: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly requestTimeoutMs?: number;
  readonly onEvent?: (event: PiRpcEvent) => void | Promise<void>;
  readonly onStderr?: (chunk: string) => void | Promise<void>;
  readonly onExit?: (error: PiRpcRuntimeError | undefined) => void | Promise<void>;
  readonly onRecord?: (record: PiRpcRecord) => void | Promise<void>;
}

interface PendingRequest {
  readonly command: string;
  readonly resolve: (response: PiRpcResponse) => void;
  readonly reject: (error: PiRpcRuntimeError) => void;
  readonly cancelTimeout: () => void;
  readonly removeAbortListener?: () => void;
}

const STDERR_LIMIT = 64 * 1024;
const CLOSE_GRACE_MS = 1_000;

export class PiRpcRuntime {
  readonly #child: NodeChildProcess.ChildProcessWithoutNullStreams;
  readonly #pending = new Map<string, PendingRequest>();
  readonly #requestTimeoutMs: number;
  readonly #options: PiRpcRuntimeOptions;
  readonly #decoder: PiRpcJsonlDecoder;
  #nextRequest = 1;
  #stderr = "";
  #closed = false;
  #intentionalClose = false;
  #fatalError: PiRpcRuntimeError | undefined;
  #dispatch = Promise.resolve();

  private constructor(
    child: NodeChildProcess.ChildProcessWithoutNullStreams,
    options: PiRpcRuntimeOptions,
  ) {
    this.#child = child;
    this.#options = options;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.#decoder = new PiRpcJsonlDecoder((record) => this.#handleRecord(record));

    child.stdout.on("data", (chunk: Buffer) => {
      if (this.#closed) return;
      try {
        this.#decoder.push(chunk);
      } catch (cause) {
        this.#failTransport(
          new PiRpcRuntimeError(
            "protocol",
            "Pi RPC stdout violated the JSONL protocol.",
            undefined,
            this.#stderr,
            {
              cause,
            },
          ),
        );
      }
    });
    child.stdout.on("end", () => {
      if (this.#closed) return;
      try {
        this.#decoder.finish();
      } catch (cause) {
        this.#failTransport(
          new PiRpcRuntimeError(
            "protocol",
            "Pi RPC stdout ended mid-record.",
            undefined,
            this.#stderr,
            {
              cause,
            },
          ),
        );
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      this.#stderr = (this.#stderr + text).slice(-STDERR_LIMIT);
      if (options.onStderr) this.#enqueue(() => options.onStderr!(text));
    });
    child.on("error", (cause) => {
      if (this.#closed) return;
      this.#failTransport(
        new PiRpcRuntimeError(
          "process",
          "Pi RPC child process emitted an error.",
          undefined,
          this.#stderr,
          {
            cause,
          },
        ),
      );
    });
    child.on("exit", (code, signal) => {
      if (this.#closed) return;
      this.#closed = true;
      const error = this.#intentionalClose
        ? undefined
        : (this.#fatalError ??
          new PiRpcRuntimeError(
            "process",
            `Pi RPC child exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
            undefined,
            this.#stderr,
          ));
      if (error) this.#rejectPending(error);
      if (options.onExit) this.#enqueue(() => options.onExit!(error));
    });
  }

  static start(options: PiRpcRuntimeOptions): Promise<PiRpcRuntime> {
    return new Promise((resolve, reject) => {
      const child = NodeChildProcess.spawn(options.binaryPath, ["--mode", "rpc", "--no-session"], {
        cwd: options.cwd,
        env: options.environment ?? process.env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
      const onError = (cause: Error) => {
        reject(
          new PiRpcRuntimeError(
            "spawn",
            `Failed to start Pi RPC process: ${options.binaryPath} --mode rpc --no-session`,
            undefined,
            undefined,
            { cause },
          ),
        );
      };
      child.once("error", onError);
      child.once("spawn", () => {
        child.off("error", onError);
        resolve(new PiRpcRuntime(child, options));
      });
    });
  }

  get stderr(): string {
    return this.#stderr;
  }

  get closed(): boolean {
    return this.#closed;
  }

  request(command: PiRpcCommand, signal?: AbortSignal): Promise<PiRpcResponse> {
    if (this.#closed || this.#fatalError) {
      return Promise.reject(
        this.#fatalError ??
          new PiRpcRuntimeError("closed", "Pi RPC process is closed.", command.type),
      );
    }
    const id = command.id ?? `t3-${this.#nextRequest++}`;
    return new Promise((resolve, reject) => {
      const timeoutFiber = Effect.runFork(
        Effect.sleep(this.#requestTimeoutMs).pipe(
          Effect.andThen(
            Effect.sync(() => {
              this.#pending.delete(id);
              reject(
                new PiRpcRuntimeError(
                  "request",
                  `Pi RPC request timed out after ${this.#requestTimeoutMs}ms.`,
                  command.type,
                  this.#stderr,
                ),
              );
            }),
          ),
        ),
      );
      const cancelTimeout = () => timeoutFiber.interruptUnsafe();
      let removeAbortListener: (() => void) | undefined;
      if (signal) {
        const onAbort = () => {
          const pending = this.#pending.get(id);
          if (!pending) return;
          this.#pending.delete(id);
          cancelTimeout();
          reject(
            new PiRpcRuntimeError(
              "cancelled",
              "Pi RPC request was cancelled.",
              command.type,
              this.#stderr,
            ),
          );
        };
        signal.addEventListener("abort", onAbort, { once: true });
        removeAbortListener = () => signal.removeEventListener("abort", onAbort);
      }
      this.#pending.set(id, {
        command: command.type,
        resolve,
        reject,
        cancelTimeout,
        ...(removeAbortListener ? { removeAbortListener } : {}),
      });
      this.#child.stdin.write(encodePiRpcCommand({ ...command, id }), (cause) => {
        if (!cause) return;
        const pending = this.#takePending(id);
        pending?.reject(
          new PiRpcRuntimeError(
            "write",
            "Failed to write Pi RPC command.",
            command.type,
            this.#stderr,
            {
              cause,
            },
          ),
        );
      });
    });
  }

  async getAvailableModels(signal?: AbortSignal): Promise<ReadonlyArray<PiRpcModel>> {
    return piRpcModelsFromResponse(await this.request({ type: "get_available_models" }, signal));
  }

  async setModel(provider: string, modelId: string, signal?: AbortSignal): Promise<PiRpcResponse> {
    return this.request({ type: "set_model", provider, modelId }, signal);
  }

  async prompt(
    message: string,
    images?: ReadonlyArray<{
      readonly type: "image";
      readonly data: string;
      readonly mimeType: string;
    }>,
    signal?: AbortSignal,
  ): Promise<PiRpcResponse> {
    return this.request(
      { type: "prompt", message, ...(images && images.length > 0 ? { images } : {}) },
      signal,
    );
  }

  async abort(signal?: AbortSignal): Promise<PiRpcResponse> {
    return this.request({ type: "abort" }, signal);
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#intentionalClose = true;
    this.#closed = true;
    this.#rejectPending(new PiRpcRuntimeError("closed", "Pi RPC process was stopped."));
    this.#child.stdin.end();
    if (this.#child.exitCode !== null || this.#child.signalCode !== null) return;
    const exited = new Promise<void>((resolve) => this.#child.once("exit", () => resolve()));
    this.#child.kill("SIGTERM");
    const graceful = await Effect.runPromise(
      Effect.raceFirst(
        Effect.promise(() => exited).pipe(Effect.as(true)),
        Effect.sleep(CLOSE_GRACE_MS).pipe(Effect.as(false)),
      ),
    );
    if (!graceful && this.#child.exitCode === null && this.#child.signalCode === null) {
      this.#child.kill("SIGKILL");
      await exited;
    }
  }

  #handleRecord(record: PiRpcRecord): void {
    if (this.#options.onRecord) this.#enqueue(() => this.#options.onRecord!(record));
    if (!isPiRpcResponse(record)) {
      if (this.#options.onEvent) this.#enqueue(() => this.#options.onEvent!(record));
      return;
    }
    if (!record.id) {
      this.#failTransport(
        new PiRpcRuntimeError(
          "protocol",
          "Pi RPC response omitted its correlation id.",
          record.command,
          this.#stderr,
        ),
      );
      return;
    }
    const pending = this.#takePending(record.id);
    if (!pending) {
      this.#failTransport(
        new PiRpcRuntimeError(
          "protocol",
          `Pi RPC returned an unknown correlation id: ${record.id}`,
          record.command,
          this.#stderr,
        ),
      );
      return;
    }
    if (!record.success) {
      pending.reject(
        new PiRpcRuntimeError(
          "request",
          record.error?.trim() || `Pi RPC rejected ${record.command}.`,
          pending.command,
          this.#stderr,
        ),
      );
      return;
    }
    pending.resolve(record);
  }

  #takePending(id: string): PendingRequest | undefined {
    const pending = this.#pending.get(id);
    if (!pending) return undefined;
    this.#pending.delete(id);
    pending.cancelTimeout();
    pending.removeAbortListener?.();
    return pending;
  }

  #rejectPending(error: PiRpcRuntimeError): void {
    for (const [id] of this.#pending) this.#takePending(id)?.reject(error);
  }

  #failTransport(error: PiRpcRuntimeError): void {
    if (this.#fatalError || this.#closed) return;
    this.#fatalError = error;
    this.#rejectPending(error);
    if (this.#options.onExit) this.#enqueue(() => this.#options.onExit!(error));
    this.#child.kill("SIGKILL");
  }

  #enqueue(action: () => void | Promise<void>): void {
    this.#dispatch = this.#dispatch.then(action).catch(() => undefined);
  }
}
