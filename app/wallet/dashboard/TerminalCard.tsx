"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = `ws://localhost:${typeof window !== "undefined" ? (window as any).__PELLET_TERMINAL_PORT || 7778 : 7778}/`;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000];

type Status = "connecting" | "connected" | "disconnected";

export function TerminalCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<any>(null);
  const retryRef = useRef(0);
  const [status, setStatus] = useState<Status>("connecting");

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      retryRef.current = 0;
      if (fitRef.current) {
        fitRef.current.fit();
        const term = termRef.current;
        if (term) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      }
    };

    ws.onmessage = (e) => {
      termRef.current?.write(e.data);
    };

    ws.onclose = () => {
      setStatus("disconnected");
      const delay = RECONNECT_DELAYS[Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)];
      retryRef.current++;
      setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      await import("@xterm/xterm/css/xterm.css");

      if (disposed) return;

      const root = containerRef.current;
      if (!root) return;

      const styles = getComputedStyle(root);
      const bg = styles.getPropertyValue("--term-bg").trim() || "#ffffff";
      const fg = styles.getPropertyValue("--term-fg").trim() || "#1a1a1a";

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        lineHeight: 1.4,
        fontFamily: "'Commit Mono', ui-monospace, 'SFMono-Regular', monospace",
        theme: { background: bg, foreground: fg, cursor: fg },
        allowProposedApi: true,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);

      try {
        const { WebglAddon } = await import("@xterm/addon-webgl");
        term.loadAddon(new WebglAddon());
      } catch {}

      term.open(root);
      fit.fit();
      termRef.current = term;
      fitRef.current = fit;

      term.onData((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(data);
        }
      });

      term.onResize(({ cols, rows }) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });

      const ro = new ResizeObserver(() => fit.fit());
      ro.observe(root);

      connect();

      return () => {
        ro.disconnect();
        term.dispose();
      };
    }

    const cleanup = init();
    return () => {
      disposed = true;
      cleanup.then((fn) => fn?.());
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <div className="spec-terminal-card">
      <div className="spec-terminal-head">
        <span className="spec-col-head-left">TERMINAL</span>
        <span className="spec-col-head-right">
          <span className="spec-terminal-status" data-status={status}>
            {status === "connected" ? "LIVE" : status === "connecting" ? "CONNECTING" : "OFFLINE"}
          </span>
        </span>
      </div>
      <div
        className="spec-terminal-body"
        ref={containerRef}
        style={{ display: status === "disconnected" && !termRef.current ? "none" : undefined }}
      />
      {status === "disconnected" && !termRef.current && (
        <div className="spec-terminal-offline">
          <pre>{`  pellet terminal\n\n  start your local bridge to connect:\n\n    npx pellet-terminal\n\n  or run alongside dev:\n\n    npm run terminal`}</pre>
        </div>
      )}
    </div>
  );
}
