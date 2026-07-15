import { describe, expect, it } from "vite-plus/test";

import { resolveTailscaleServeLocalPort } from "./server.ts";

describe("resolveTailscaleServeLocalPort", () => {
  it("targets the backend listener by default", () => {
    expect(
      resolveTailscaleServeLocalPort({
        backendPort: 13773,
        tailscaleServeWeb: false,
        devUrl: new URL("http://127.0.0.1:5733"),
      }),
    ).toBe(13773);
  });

  it("targets the Vite dev URL port in web serve mode", () => {
    expect(
      resolveTailscaleServeLocalPort({
        backendPort: 13773,
        tailscaleServeWeb: true,
        devUrl: new URL("http://127.0.0.1:5734"),
      }),
    ).toBe(5734);
  });

  it("returns null when web serve mode has no Vite URL", () => {
    expect(
      resolveTailscaleServeLocalPort({
        backendPort: 13773,
        tailscaleServeWeb: true,
        devUrl: undefined,
      }),
    ).toBeNull();
  });
});
