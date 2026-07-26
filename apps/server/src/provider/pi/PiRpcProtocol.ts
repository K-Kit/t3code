export interface PiRpcModel {
  readonly id: string;
  readonly name?: string;
  readonly provider: string;
  readonly reasoning?: boolean;
  readonly input?: ReadonlyArray<string>;
  readonly contextWindow?: number;
  readonly maxTokens?: number;
  readonly [key: string]: unknown;
}

export interface PiRpcResponse {
  readonly id?: string;
  readonly type: "response";
  readonly command: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

export interface PiRpcCommand {
  readonly id?: string;
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface PiRpcContent {
  readonly type: string;
  readonly text?: string;
  readonly [key: string]: unknown;
}

export interface PiRpcToolResult {
  readonly content?: ReadonlyArray<PiRpcContent>;
  readonly details?: unknown;
  readonly [key: string]: unknown;
}

export interface PiRpcAssistantMessageEvent {
  readonly type: string;
  readonly contentIndex?: number;
  readonly delta?: string;
  readonly content?: string;
  readonly reason?: string;
  readonly toolCall?: unknown;
  readonly [key: string]: unknown;
}

export type PiRpcEvent =
  | { readonly type: "agent_start" }
  | { readonly type: "agent_settled" }
  | { readonly type: "turn_start" }
  | { readonly type: "turn_end"; readonly message?: unknown; readonly toolResults?: unknown }
  | {
      readonly type: "message_update";
      readonly message?: unknown;
      readonly assistantMessageEvent: PiRpcAssistantMessageEvent;
    }
  | {
      readonly type: "tool_execution_start";
      readonly toolCallId: string;
      readonly toolName: string;
      readonly args?: unknown;
    }
  | {
      readonly type: "tool_execution_update";
      readonly toolCallId: string;
      readonly toolName: string;
      readonly args?: unknown;
      readonly partialResult?: PiRpcToolResult;
    }
  | {
      readonly type: "tool_execution_end";
      readonly toolCallId: string;
      readonly toolName: string;
      readonly result?: PiRpcToolResult;
      readonly isError?: boolean;
    }
  | { readonly type: "extension_error"; readonly [key: string]: unknown }
  | {
      readonly type:
        | "agent_end"
        | "message_start"
        | "message_end"
        | "queue_update"
        | "compaction_start"
        | "compaction_end"
        | "auto_retry_start"
        | "auto_retry_end";
      readonly [key: string]: unknown;
    };

export type PiRpcRecord = PiRpcResponse | PiRpcEvent;

export class PiRpcProtocolError extends Error {
  override readonly name = "PiRpcProtocolError";

  readonly record: string | undefined;

  constructor(message: string, record?: string, options?: ErrorOptions) {
    super(message, options);
    this.record = record;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPiRpcResponse(value: unknown): value is PiRpcResponse {
  return (
    isRecord(value) &&
    value.type === "response" &&
    typeof value.command === "string" &&
    typeof value.success === "boolean" &&
    (value.id === undefined || typeof value.id === "string")
  );
}

export function parsePiRpcRecord(line: string): PiRpcRecord {
  let decoded: unknown;
  try {
    decoded = JSON.parse(line);
  } catch (cause) {
    throw new PiRpcProtocolError("Pi RPC stdout contained malformed JSON.", line, { cause });
  }
  if (!isRecord(decoded) || typeof decoded.type !== "string") {
    throw new PiRpcProtocolError(
      "Pi RPC stdout record must be an object with a string type.",
      line,
    );
  }
  if (decoded.type === "response" && !isPiRpcResponse(decoded)) {
    throw new PiRpcProtocolError("Pi RPC response has an invalid shape.", line);
  }
  return decoded as PiRpcRecord;
}

export function encodePiRpcCommand(command: PiRpcCommand): string {
  return `${JSON.stringify(command)}\n`;
}

/** Strict LF-only JSONL decoder. U+2028/U+2029 remain ordinary JSON string content. */
export class PiRpcJsonlDecoder {
  readonly #decoder = new TextDecoder();
  #buffer = "";

  readonly onRecord: (record: PiRpcRecord) => void;
  readonly maxRecordChars: number;

  constructor(onRecord: (record: PiRpcRecord) => void, maxRecordChars = 16 * 1024 * 1024) {
    this.onRecord = onRecord;
    this.maxRecordChars = maxRecordChars;
  }

  push(chunk: Uint8Array): void {
    this.#buffer += this.#decoder.decode(chunk, { stream: true });
    this.#drain();
    if (this.#buffer.length > this.maxRecordChars) {
      throw new PiRpcProtocolError("Pi RPC stdout record exceeded the maximum size.");
    }
  }

  finish(): void {
    this.#buffer += this.#decoder.decode();
    this.#drain();
    if (this.#buffer.length > 0) {
      throw new PiRpcProtocolError(
        "Pi RPC stdout ended with an unterminated JSONL record.",
        this.#buffer,
      );
    }
  }

  #drain(): void {
    while (true) {
      const newline = this.#buffer.indexOf("\n");
      if (newline < 0) return;
      let line = this.#buffer.slice(0, newline);
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.length === 0) {
        throw new PiRpcProtocolError("Pi RPC stdout contained an empty JSONL record.");
      }
      this.onRecord(parsePiRpcRecord(line));
    }
  }
}

export function piRpcModelsFromResponse(response: PiRpcResponse): ReadonlyArray<PiRpcModel> {
  const data = response.data;
  if (!isRecord(data) || !Array.isArray(data.models)) {
    throw new PiRpcProtocolError("get_available_models returned an invalid response payload.");
  }
  const models: PiRpcModel[] = [];
  for (const model of data.models) {
    if (!isRecord(model) || typeof model.id !== "string" || typeof model.provider !== "string") {
      throw new PiRpcProtocolError("get_available_models returned an invalid model entry.");
    }
    models.push(model as PiRpcModel);
  }
  return models;
}

export function piRpcText(result: PiRpcToolResult | undefined): string {
  if (!result?.content) return "";
  return result.content
    .filter(
      (part): part is PiRpcContent & { readonly text: string } =>
        part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("");
}
