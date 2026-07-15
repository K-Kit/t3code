export function resolveDevProxyTarget(wsUrl: string | undefined): string | undefined {
  if (!wsUrl) {
    return undefined;
  }

  try {
    const url = new URL(wsUrl);
    if (url.protocol === "ws:") {
      url.protocol = "http:";
    } else if (url.protocol === "wss:") {
      url.protocol = "https:";
    }
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

export function buildDevServerProxy(proxyTarget: string | undefined) {
  if (!proxyTarget) {
    return undefined;
  }

  return {
    "/.well-known": {
      target: proxyTarget,
      changeOrigin: true,
    },
    "/api": {
      target: proxyTarget,
      changeOrigin: true,
    },
    "/oauth": {
      target: proxyTarget,
      changeOrigin: true,
    },
    "/attachments": {
      target: proxyTarget,
      changeOrigin: true,
    },
    "/ws": {
      target: proxyTarget,
      changeOrigin: true,
      ws: true,
    },
  } as const;
}

export function buildDevServerHmr(input: {
  readonly host: string;
  readonly port: number;
  readonly tailscaleServeWeb: boolean;
}) {
  if (input.tailscaleServeWeb) {
    // Let the browser reuse the MagicDNS hostname from the page URL and connect
    // HMR over the Tailscale HTTPS endpoint (default port 443).
    return {
      protocol: "wss" as const,
      clientPort: 443,
    };
  }

  return {
    // Explicit config so Vite's HMR WebSocket connects reliably
    // inside Electron's BrowserWindow. Vite 8 uses console.debug for
    // connection logs — enable "Verbose" in DevTools to see them.
    protocol: "ws" as const,
    host: input.host,
    clientPort: input.port,
  };
}
