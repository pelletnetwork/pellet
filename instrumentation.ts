export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "production") {
    const { spawn } = await import("node:child_process");
    const { resolve } = await import("node:path");

    const script = resolve(process.cwd(), "scripts/terminal-bridge.js");
    const child = spawn("node", [script], {
      stdio: "inherit",
      detached: false,
      env: { ...process.env, PELLET_TERMINAL_PORT: "7778" },
    });

    child.unref();

    process.on("exit", () => {
      try { child.kill(); } catch {}
    });
  }
}
