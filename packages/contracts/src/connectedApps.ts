import * as Schema from "effect/Schema";
import { ProviderInstanceId } from "./providerInstance.ts";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const ConnectedApp = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.String,
  installUrl: Schema.NullOr(Schema.String),
  state: Schema.Literals(["ready", "disabled", "not-connected", "unavailable"]),
});
export type ConnectedApp = typeof ConnectedApp.Type;
export const ConnectedAppsInput = Schema.Struct({
  instanceId: ProviderInstanceId,
  cursor: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(2048))),
});
export type ConnectedAppsInput = typeof ConnectedAppsInput.Type;
export const ConnectedAppsPage = Schema.Struct({
  supported: Schema.Boolean,
  apps: Schema.Array(ConnectedApp),
  nextCursor: Schema.NullOr(Schema.String),
});
export type ConnectedAppsPage = typeof ConnectedAppsPage.Type;
export class ConnectedAppsError extends Schema.TaggedErrorClass<ConnectedAppsError>()(
  "ConnectedAppsError",
  {
    message: Schema.String,
  },
) {}
