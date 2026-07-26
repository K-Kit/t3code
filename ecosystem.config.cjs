// PM2 ecosystem config for the t3code dev server (kpop/Tailscale variant).
// Uses an explicit PATH because the PM2 daemon does not inherit the interactive
// login-shell environment, so `pnpm`/`node` (installed via mise/nvm) are otherwise
// unresolved and the process crash-loops with "pnpm: command not found".
module.exports = {
  apps: [
    {
      name: "t3-dev-kpop",
      cwd: "/home/kit/t3code",
      script: "pnpm",
      args: "dev:kpop",
      interpreter: "none",
      // Auto-restart behaviour.
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "20s",
      restart_delay: 5000,
      exp_backoff_restart_delay: 200,
      kill_timeout: 10000,
      env: {
        NODE_ENV: "development",
        PATH: "/home/kit/.nvm/versions/node/v24.18.0/bin:/home/kit/.local/bin:/home/kit/bin:/home/kit/.bun/bin:/home/kit/.local/share/mise/installs/pnpm/latest:/home/kit/.local/share/mise/installs/npm/latest/package/bin:/home/kit/.local/share/mise/installs/usage/latest:/home/kit/.local/share/pi-node/node-v22.23.1-linux-x64/bin:/home/kit/.pyenv/shims:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/home/kit/.cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/home/kit/.local/share/JetBrains/Toolbox/scripts:/home/kit/.grok/bin:/home/kit/.opencode/bin",
        T3CODE_TAILSCALE_SERVE_SERVICE: "svc:t3",
      },
    },
  ],
};
