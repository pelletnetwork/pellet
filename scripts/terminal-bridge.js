#!/usr/bin/env node

const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const os = require("os");
const path = require("path");

const PORT = parseInt(process.env.PELLET_TERMINAL_PORT || "7778", 10);
const SHELL = process.env.SHELL || "/bin/zsh";
const SCROLLBACK_BYTES = 16 * 1024;

let term = null;
let client = null;
let scrollback = "";
let sessionAddr = null;

function spawn() {
  if (term) return;
  scrollback = "";
  const t = pty.spawn(SHELL, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      TERM: "xterm-256color",
      SHELL,
      ZDOTDIR: path.resolve(__dirname, "pellet-shell"),
    },
  });
  term = t;

  t.onData((data) => {
    if (term !== t) return;
    scrollback += data;
    if (scrollback.length > SCROLLBACK_BYTES * 2) {
      scrollback = scrollback.slice(-SCROLLBACK_BYTES);
    }
    if (client?.readyState === 1) client.send(data);
  });

  t.onExit(() => {
    if (term !== t) return;
    term = null;
    scrollback = "";
    if (client?.readyState === 1) client.close();
    client = null;
  });
}

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });

wss.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`terminal bridge: port ${PORT} in use, exiting`);
    process.exit(0);
  }
  throw err;
});

wss.on("listening", () => {
  console.log(`pellet terminal bridge ws://localhost:${PORT}`);
});

wss.on("connection", (ws) => {
  if (client) {
    client.removeAllListeners?.();
    client.close(4001, "replaced");
  }
  client = ws;

  ws.on("message", (msg) => {
    const str = msg.toString();
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "session") {
        const addr = parsed.address || "";
        if (sessionAddr && addr !== sessionAddr && term) {
          term.kill();
          term = null;
          scrollback = "";
        }
        sessionAddr = addr;

        const fresh = !term;
        if (!term) spawn();
        ws.send(JSON.stringify({ type: "init", fresh }));
        if (!fresh && scrollback) ws.send(scrollback);
        return;
      }
      if (parsed.type === "resize" && parsed.cols && parsed.rows) {
        if (term) term.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {}
    if (term) term.write(str);
  });

  ws.on("close", () => {
    if (client === ws) client = null;
  });
});
