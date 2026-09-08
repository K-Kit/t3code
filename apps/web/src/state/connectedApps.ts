import { createConnectedAppsEnvironmentAtoms } from "@t3tools/client-runtime/state/connectedApps";
import { connectionAtomRuntime } from "../connection/runtime";
export const connectedAppsEnvironment = createConnectedAppsEnvironmentAtoms(connectionAtomRuntime);
