import * as Cause from "effect/Cause";
import type { AsyncResult } from "effect/unstable/reactivity";
export function documentError(result: AsyncResult.AsyncResult<unknown, unknown>): string {
  if (result._tag !== "Failure") return "The operation was interrupted. Try again.";
  const error = Cause.squash(result.cause);
  return error instanceof Error
    ? error.message
    : "The document could not be loaded. Please reconnect and try again.";
}
