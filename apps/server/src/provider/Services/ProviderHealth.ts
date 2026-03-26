/**
 * ProviderHealth - Provider readiness snapshot service.
 *
 * Owns provider health checks (install/auth reachability) and exposes the
 * latest results to transport layers.
 *
 * @module ProviderHealth
 */
import type { ServerProviderStatus } from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect, Stream } from "effect";

export interface ProviderHealthShape {
  /**
   * Read the latest provider health statuses.
   */
  readonly getStatuses: Effect.Effect<ReadonlyArray<ServerProviderStatus>>;
  /**
   * Replace one provider status in the latest snapshot.
   */
  readonly setStatus: (
    provider: ServerProviderStatus["provider"],
    nextStatus: ServerProviderStatus,
  ) => Effect.Effect<void>;
  /**
   * Replace the entire provider health snapshot.
   */
  readonly replaceStatuses: (
    nextStatuses: ReadonlyArray<ServerProviderStatus>,
  ) => Effect.Effect<void>;
  /**
   * Subscribe to runtime provider health changes.
   */
  readonly streamChanges: Stream.Stream<ReadonlyArray<ServerProviderStatus>>;
}

export class ProviderHealth extends ServiceMap.Service<ProviderHealth, ProviderHealthShape>()(
  "t3/provider/Services/ProviderHealth",
) {}
