# Dashboard Terminal Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chat interface with an embedded xterm.js terminal as the primary dashboard interaction surface.

**Architecture:** xterm.js client component in the main dashboard column connects via websocket to a local PTY bridge server. Signed payments moves to a compact scrollable card in the right rail. Chat components removed from dashboard. Nav swaps Chat→Txs.

**Tech Stack:** @xterm/xterm, @xterm/addon-fit, @xterm/addon-webgl, ws, node-pty

---

### Task 1: Install xterm.js dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install xterm packages**

```bash
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-webgl
```

- [ ] **Step 2: Install bridge dependencies**

```bash
npm install --save-dev node-pty ws @types/ws
```

- [ ] **Step 3: Verify install succeeded**

```bash
npm ls @xterm/xterm @xterm/addon-fit @xterm/addon-webgl node-pty ws
```

Expected: all packages listed, no UNMET PEER warnings.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add xterm.js and terminal bridge dependencies"
```

---

### Task 2: Create the local WebSocket PTY bridge

**Files:**
- Create: `scripts/terminal-bridge.js`

- [ ] **Step 1: Create the bridge script**

```js
#!/usr/bin/env node

const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const os = require("os");

const PORT = parseInt(process.env.PELLET_TERMINAL_PORT || "7778", 10);
const SHELL = process.env.SHELL || (os.platform() === "win32" ? "powershell.exe" : "/bin/zsh");

let activeConnection = null;

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });

console.log(`pellet terminal bridge listening on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  if (activeConnection) {
    ws.close(4001, "another session is already active");
    return;
  }

  const term = pty.spawn(SHELL, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: {
      ...process.env,
      PELLET_WALLET: "1",
      TERM: "xterm-256color",
    },
  });

  activeConnection = ws;

  term.onData((data) => {
    if (ws.readyState === 1) ws.send(data);
  });

  ws.on("message", (msg) => {
    const str = msg.toString();
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "resize" && parsed.cols && parsed.rows) {
        term.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {}
    term.write(str);
  });

  ws.on("close", () => {
    term.kill();
    activeConnection = null;
  });

  term.onExit(() => {
    if (ws.readyState === 1) ws.close(1000, "shell exited");
    activeConnection = null;
  });
});
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/terminal-bridge.js
```

- [ ] **Step 3: Test the bridge starts**

```bash
node scripts/terminal-bridge.js &
# Expected: "pellet terminal bridge listening on ws://localhost:7778"
kill %1
```

- [ ] **Step 4: Add npm script**

Add to `package.json` scripts:

```json
"terminal": "node scripts/terminal-bridge.js"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/terminal-bridge.js package.json
git commit -m "feat: local websocket PTY bridge for dashboard terminal"
```

---

### Task 3: Create the TerminalCard component

**Files:**
- Create: `app/wallet/dashboard/TerminalCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx next build 2>&1 | tail -5
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/wallet/dashboard/TerminalCard.tsx
git commit -m "feat: TerminalCard component with xterm.js and websocket"
```

---

### Task 4: Add terminal card CSS to specimen-wallet.css

**Files:**
- Modify: `app/specimen/specimen-wallet.css`

- [ ] **Step 1: Add terminal card styles**

After the existing `.spec-wallet-float .chat-rail-card` block (line ~196), add:

```css
/* ── Terminal card ──────────────────────────────────────────────────────── */
.spec-terminal-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.spec-terminal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
}

.spec-terminal-status {
  font-size: 10px;
  letter-spacing: 0.06em;
}
.spec-terminal-status[data-status="connected"] { opacity: 0.55; }
.spec-terminal-status[data-status="connecting"] { opacity: 0.4; }
.spec-terminal-status[data-status="disconnected"] { opacity: 0.3; }

.spec-terminal-body {
  flex: 1;
  min-height: 300px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--term-bg, var(--bg));
  border: 1px solid color-mix(in oklch, var(--fg) 8%, var(--bg));
  --term-bg: var(--bg);
  --term-fg: var(--fg);
}
.specimen-shell.dark .spec-terminal-body {
  --term-bg: var(--bg);
  --term-fg: var(--fg);
}

.spec-terminal-body .xterm {
  padding: 12px 14px;
}
.spec-terminal-body .xterm-viewport {
  border-radius: 12px;
}

.spec-terminal-offline {
  flex: 1;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid color-mix(in oklch, var(--fg) 8%, var(--bg));
  background: color-mix(in oklch, var(--fg) 3%, var(--bg));
}
.spec-terminal-offline pre {
  font-family: 'Commit Mono', ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: color-mix(in oklch, var(--fg) 45%, var(--bg));
  white-space: pre;
}
```

- [ ] **Step 2: Add mobile overrides**

In the existing `@media (max-width: 600px)` block (around line 1021), add:

```css
  .spec-terminal-body {
    min-height: 50vh;
    max-height: 50vh;
  }
  .spec-terminal-offline {
    min-height: 50vh;
    max-height: 50vh;
  }
```

- [ ] **Step 3: Commit**

```bash
git add app/specimen/specimen-wallet.css
git commit -m "feat: terminal card CSS with mobile responsive"
```

---

### Task 5: Swap dashboard layout — terminal to main, payments to rail

**Files:**
- Modify: `app/oli/wallet/dashboard/SpecimenWalletDashboard.tsx`

- [ ] **Step 1: Add TerminalCard import**

Replace the ChatRailCard and ChatDrawer imports (lines 8-9) with:

```tsx
import { TerminalCard } from "@/app/wallet/dashboard/TerminalCard";
```

- [ ] **Step 2: Rewrite ActivityColumn to render TerminalCard**

Replace the entire `ActivityColumn` function (lines 702-758) with:

```tsx
function ActivityColumn() {
  return (
    <div className="spec-col-activity">
      <TerminalCard />
    </div>
  );
}
```

- [ ] **Step 3: Update ActivityColumn call site**

At line 685, change:

```tsx
<ActivityColumn payments={signedPayments7d} basePath={basePath} />
```

to:

```tsx
<ActivityColumn />
```

- [ ] **Step 4: Add SignedPaymentsRailCard to RightRail**

Add a compact scrollable payments card in RightRail. After the `AgentIdentityCard` render (line 786) and replacing the `ChatRailCard` render (line 788), insert:

```tsx
      <div className="spec-rail-payments">
        <div className="spec-col-head">
          <span className="spec-col-head-left">SIGNED PAYMENTS</span>
          <span className="spec-col-head-right">
            <span>{payments.length} total</span>
          </span>
        </div>
        <div className="spec-rail-payments-scroll">
          {payments.length === 0 ? (
            <div style={{ padding: "16px 0", opacity: 0.5, fontSize: 11, textAlign: "center" }}>
              No signed payments yet.
            </div>
          ) : (
            payments.map((p) => (
              <SpecimenPaymentRow key={p.id} payment={p} basePath={basePath} />
            ))
          )}
        </div>
        <Link
          href={`${basePath}/dashboard/txs`}
          className="spec-rail-payments-link"
        >
          View all transactions →
        </Link>
      </div>
```

- [ ] **Step 5: Update RightRail props**

Add `payments` and `basePath` to RightRail's props interface. The `payments` prop is the same `signedPayments7d` array. Remove `chatMessages` from the props since ChatRailCard is gone.

Update the RightRail function signature (line 761):

```tsx
function RightRail({
  sessions,
  agents,
  basePath,
  payments,
  revoking,
  onRevoke,
  expiredCount,
}: {
  sessions: Session[];
  agents: Agent[];
  basePath: string;
  payments: Payment[];
  revoking: string | null;
  onRevoke: (id: string) => void;
  expiredCount: number;
}) {
```

Update the call site (line 686):

```tsx
        <RightRail
          sessions={sessions}
          agents={connectedAgents}
          basePath={basePath}
          payments={signedPayments7d}
          revoking={revoking}
          onRevoke={onRevoke}
          expiredCount={revokedOrExpired.length}
        />
```

- [ ] **Step 6: Remove ChatDrawer render**

Delete line 697:

```tsx
      <ChatDrawer agentNames={...} initialMessages={chatMessages} />
```

- [ ] **Step 7: Remove unused ChatRailCard and ChatDrawer imports**

Remove the imports for ChatRailCard and ChatDrawer that were replaced in step 1.

- [ ] **Step 8: Add rail payments CSS**

Add to `app/specimen/specimen-wallet.css`, after the terminal card styles:

```css
/* ── Signed payments rail card ─────────────────────────────────────────── */
.spec-rail-payments {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.spec-rail-payments-scroll {
  max-height: 280px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.spec-rail-payments-scroll::-webkit-scrollbar { width: 3px; }
.spec-rail-payments-scroll::-webkit-scrollbar-track { background: transparent; }
.spec-rail-payments-scroll::-webkit-scrollbar-thumb { background: var(--line-thin, var(--line)); }

.spec-rail-payments-link {
  display: block;
  padding: 10px 0 0;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  color: inherit;
  opacity: 0.45;
  transition: opacity 0.15s ease;
}
.spec-rail-payments-link:hover {
  opacity: 0.8;
}
```

- [ ] **Step 9: Build and verify**

```bash
npx next build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add app/oli/wallet/dashboard/SpecimenWalletDashboard.tsx app/specimen/specimen-wallet.css
git commit -m "feat: terminal in main column, payments in rail"
```

---

### Task 6: Update navigation — Chat → Txs

**Files:**
- Modify: `components/oli/WalletTabs.tsx`

- [ ] **Step 1: Replace Chat tab with Txs**

In the `TABS` array (line 9), change:

```tsx
  { label: "CHAT", href: "/chat" },
```

to:

```tsx
  { label: "TXS", href: "/dashboard/txs" },
```

- [ ] **Step 2: Commit**

```bash
git add components/oli/WalletTabs.tsx
git commit -m "feat: swap Chat tab for Txs in wallet nav"
```

---

### Task 7: Create the full transactions page

**Files:**
- Create: `app/oli/wallet/dashboard/txs/page.tsx`

- [ ] **Step 1: Create the transactions page**

```tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SpecimenPaymentRow } from "@/components/oli/SpecimenPaymentRow";
import { WalletTabs } from "@/components/oli/WalletTabs";

export default async function TxsPage() {
  const session = await verifySession(await cookies());
  if (!session) redirect("/oli/wallet/sign-in");

  const allPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.walletId, session.walletId))
    .orderBy(desc(payments.createdAt))
    .limit(200);

  const basePath = "/oli/wallet";

  return (
    <div className="spec-wallet-float">
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Transactions</span>
          </h1>
          <div className="spec-wallet-tabs-float">
            <WalletTabs basePath={basePath} />
          </div>
        </div>
        <div className="spec-page-subhead">
          <span>{allPayments.length} transactions</span>
        </div>
      </section>

      <section style={{ padding: "0 32px 48px" }}>
        {allPayments.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", opacity: 0.5, fontSize: 13 }}>
            No transactions yet. When an agent signs a payment, it appears here.
          </div>
        ) : (
          <>
            <div className="spec-activity-head">
              <span className="spec-pay-col-when" style={{ width: 80, flexShrink: 0 }}>WHEN</span>
              <span className="spec-pay-col-tx" style={{ width: 92, flexShrink: 0 }}>TX</span>
              <span style={{ flex: 1, minWidth: 0 }}>PAYMENT / POLICY</span>
              <span className="spec-pay-col-session spec-cell-r" style={{ width: 86, flexShrink: 0 }}>SESSION</span>
              <span className="spec-pay-col-amount spec-cell-r" style={{ width: 100, flexShrink: 0 }}>AMOUNT</span>
              <span style={{ width: 70, flexShrink: 0 }} className="spec-cell-r">STATUS</span>
            </div>
            {allPayments.map((p) => (
              <SpecimenPaymentRow key={p.id} payment={p} basePath={basePath} />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page builds**

```bash
npx next build 2>&1 | tail -10
```

Expected: `/oli/wallet/dashboard/txs` appears in the route list.

Note: The exact DB query and schema imports may need adjusting to match the actual schema. Check `lib/db/schema.ts` for the correct table name and column names. The `verifySession` import path may also differ — check existing dashboard pages for the pattern.

- [ ] **Step 3: Commit**

```bash
git add app/oli/wallet/dashboard/txs/page.tsx
git commit -m "feat: full transactions page at /dashboard/txs"
```

---

### Task 8: Update canonical Dashboard.tsx

**Files:**
- Modify: `app/wallet/dashboard/Dashboard.tsx`

- [ ] **Step 1: Remove ChatDrawer import and render**

Remove the ChatDrawer import (line 5) and its render (line 812). The canonical dashboard should follow the same terminal-first layout but may be implemented incrementally — for now, just remove the chat components.

- [ ] **Step 2: Build and verify**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add app/wallet/dashboard/Dashboard.tsx
git commit -m "refactor: remove ChatDrawer from canonical dashboard"
```

---

### Task 9: Create the onboarding welcome script

**Files:**
- Create: `scripts/welcome.sh`

- [ ] **Step 1: Create the welcome script**

```bash
#!/usr/bin/env bash
set -euo pipefail

FLAG="$HOME/.pellet/.onboarded"

if [[ -f "$FLAG" ]]; then
  exec "$SHELL"
fi

clear

cat << 'ART'

  pellet

ART

echo ""
echo "  which agent? (type name)"
printf "  > "
read -r AGENT_NAME

AGENT_NAME=$(echo "$AGENT_NAME" | tr '[:upper:]' '[:lower:]' | xargs)

if [[ -z "$AGENT_NAME" ]]; then
  echo ""
  echo "  no agent specified — dropping to shell"
  echo ""
  exec "$SHELL"
fi

MCP_ENTRY='{ "command": "npx", "args": ["pellet-mcp"] }'

case "$AGENT_NAME" in
  claude)
    CONFIG="$HOME/.claude/settings.json"
    if [[ -f "$CONFIG" ]]; then
      echo ""
      echo "  found claude at $CONFIG"
      echo "  add pellet wallet to claude's MCP servers? (y/n)"
      printf "  > "
      read -r CONFIRM
      if [[ "$CONFIRM" =~ ^[Yy] ]]; then
        # Add pellet to mcpServers using node for safe JSON manipulation
        node -e "
          const fs = require('fs');
          const cfg = JSON.parse(fs.readFileSync('$CONFIG', 'utf8'));
          cfg.mcpServers = cfg.mcpServers || {};
          cfg.mcpServers.pellet = { command: 'npx', args: ['pellet-mcp'] };
          fs.writeFileSync('$CONFIG', JSON.stringify(cfg, null, 2) + '\n');
        "
        echo ""
        echo "  done. launching claude..."
      else
        echo ""
        echo "  skipped. launching claude..."
      fi
    else
      echo ""
      echo "  claude config not found at $CONFIG"
      echo "  add this to your MCP config:"
      echo ""
      echo "    \"pellet\": $MCP_ENTRY"
      echo ""
      echo "  launching claude..."
    fi
    echo ""
    mkdir -p "$HOME/.pellet"
    touch "$FLAG"
    exec claude
    ;;
  codex)
    echo ""
    echo "  add this MCP server to your codex config:"
    echo ""
    echo "    \"pellet\": $MCP_ENTRY"
    echo ""
    echo "  launching codex..."
    echo ""
    mkdir -p "$HOME/.pellet"
    touch "$FLAG"
    exec codex
    ;;
  *)
    echo ""
    echo "  to connect $AGENT_NAME, add this MCP server:"
    echo ""
    echo "    \"pellet\": $MCP_ENTRY"
    echo ""
    echo "  dropping to shell..."
    echo ""
    mkdir -p "$HOME/.pellet"
    touch "$FLAG"
    exec "$SHELL"
    ;;
esac
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/welcome.sh
```

- [ ] **Step 3: Update terminal bridge to use welcome script on first run**

In `scripts/terminal-bridge.js`, change the shell spawn to check for the onboarded flag:

Replace the `pty.spawn` call with:

```js
  const onboarded = require("fs").existsSync(
    require("path").join(os.homedir(), ".pellet", ".onboarded")
  );
  const shellCmd = onboarded ? SHELL : require("path").resolve(__dirname, "welcome.sh");
  const shellArgs = onboarded ? [] : [];

  const term = pty.spawn(shellCmd, shellArgs, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: {
      ...process.env,
      PELLET_WALLET: "1",
      SHELL: SHELL,
      TERM: "xterm-256color",
    },
  });
```

- [ ] **Step 4: Commit**

```bash
git add scripts/welcome.sh scripts/terminal-bridge.js
git commit -m "feat: first-run onboarding with guided agent setup"
```

---

### Task 10: Clean up removed chat CSS

**Files:**
- Modify: `app/specimen/specimen-wallet.css`

- [ ] **Step 1: Remove chat rail card styles**

Delete lines 185-204 (the `.spec-wallet-float .chat-rail-card` block and related `.chat-rail-msg-bubble`, `.chat-rail-input-wrap` overrides).

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add app/specimen/specimen-wallet.css
git commit -m "refactor: remove chat rail card CSS"
```

---

### Task 11: End-to-end manual test

- [ ] **Step 1: Start the terminal bridge**

```bash
npm run terminal
```

Expected: "pellet terminal bridge listening on ws://localhost:7778"

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Open the dashboard in browser**

Navigate to the wallet dashboard. Verify:
- Terminal card is in the main (left) column
- Terminal shows "LIVE" status and accepts input
- Signed payments card is in the right rail, scrollable
- Agent identity card is at top of rail
- Session keys and pending auths are below payments
- "TXS" appears in nav bar instead of "CHAT"
- Clicking "TXS" navigates to full transactions page
- Mobile layout stacks terminal on top at ~50vh

- [ ] **Step 4: Test disconnected state**

Kill the terminal bridge process. Verify the terminal card shows the offline connection instructions.

- [ ] **Step 5: Test first-run onboarding**

```bash
rm -f ~/.pellet/.onboarded
```

Restart the bridge and refresh. Verify the welcome flow appears with the ASCII wordmark and agent prompt.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: terminal integration polish from manual testing"
```
