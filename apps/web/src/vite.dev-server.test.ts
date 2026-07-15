import { describe, expect, it } from "vite-plus/test";

import { buildDevServerHmr, buildDevServerProxy, resolveDevProxyTarget } from "./vite.dev-server";

describe("vite.dev-server", () => {
  it("derives an http proxy target from a websocket url", () => {
    expect(resolveDevProxyTarget("ws://127.0.0.1:13773/ws")).toBe("http://127.0.0.1:13773/");
    expect(resolveDevProxyTarget("wss://backend.example.com:8443/path")).toBe(
      "https://backend.example.com:8443/",
    );
    expect(resolveDevProxyTarget("not a url")).toBeUndefined();
  });

  it("builds the remote-ready proxy map including websocket upgrades", () => {
    const proxy = buildDevServerProxy("http://127.0.0.1:13773/");
    expect(proxy).toEqual({
      "/.well-known": { target: "http://127.0.0.1:13773/", changeOrigin: true },
      "/api": { target: "http://127.0.0.1:13773/", changeOrigin: true },
      "/oauth": { target: "http://127.0.0.1:13773/", changeOrigin: true },
      "/attachments": { target: "http://127.0.0.1:13773/", changeOrigin: true },
      "/ws": { target: "http://127.0.0.1:13773/", changeOrigin: true, ws: true },
    });
    expect(buildDevServerProxy(undefined)).toBeUndefined();
  });

  it("uses wss HMR through Tailscale HTTPS for remote web serve mode", () => {
    expect(
      buildDevServerHmr({
        host: "127.0.0.1",
        port: 5733,
        tailscaleServeWeb: true,
      }),
    ).toEqual({
      protocol: "wss",
      clientPort: 443,
    });

    expect(
      buildDevServerHmr({
        host: "localhost",
        port: 5733,
        tailscaleServeWeb: false,
      }),
    ).toEqual({
      protocol: "ws",
      host: "localhost",
      clientPort: 5733,
    });
  });
});
